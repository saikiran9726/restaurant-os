package com.restaurantos.plugins.printer

import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothSocket
import android.content.Context
import android.hardware.usb.UsbConstants
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbDeviceConnection
import android.hardware.usb.UsbEndpoint
import android.hardware.usb.UsbInterface
import android.hardware.usb.UsbManager
import android.util.Base64
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import java.io.OutputStream
import java.net.InetSocketAddress
import java.net.Socket
import java.util.UUID

/**
 * Restaurant OS Custom Thermal Printer Plugin for Capacitor Android.
 * Provides direct byte stream access for Bluetooth RFCOMM (SPP), USB Host, and LAN raw TCP.
 */
@CapacitorPlugin(name = "PrinterPlugin")
class PrinterPlugin : Plugin() {

    companion object {
        // Standard Bluetooth Serial Port Profile (SPP) UUID
        private val SPP_UUID: UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")
        private const val DEFAULT_LAN_PORT = 9100
        private const val SOCKET_TIMEOUT_MS = 5000
    }

    private var activeBtSocket: BluetoothSocket? = null
    private var activeTcpSocket: Socket? = null
    private var activeUsbConnection: UsbDeviceConnection? = null
    private var activeUsbEndpoint: UsbEndpoint? = null

    /**
     * Discovers paired Bluetooth devices or attached USB printers.
     */
    @PluginMethod
    fun discover(call: PluginCall) {
        val transport = call.getString("transport") ?: "bluetooth"
        val devices = JSArray()

        try {
            when (transport) {
                "bluetooth" -> {
                    val btAdapter = BluetoothAdapter.getDefaultAdapter()
                    if (btAdapter != null && btAdapter.isEnabled) {
                        val pairedDevices: Set<BluetoothDevice>? = btAdapter.bondedDevices
                        pairedDevices?.forEach { device ->
                            val obj = JSObject()
                            obj.put("name", device.name ?: "Unknown Bluetooth Printer")
                            obj.put("address", device.address)
                            obj.put("transport", "bluetooth")
                            devices.put(obj)
                        }
                    }
                }
                "usb" -> {
                    val usbManager = context.getSystemService(Context.USB_SERVICE) as UsbManager
                    usbManager.deviceList.values.forEach { device ->
                        // Check if printer class (7) or vendor-specific interface
                        val obj = JSObject()
                        obj.put("name", device.productName ?: "USB Thermal Printer")
                        obj.put("address", device.deviceName)
                        obj.put("vendorId", device.vendorId)
                        obj.put("productId", device.productId)
                        obj.put("transport", "usb")
                        devices.put(obj)
                    }
                }
                "lan" -> {
                    // LAN discovery via broadcast or subnet scan placeholder
                }
            }
            val ret = JSObject()
            ret.put("devices", devices)
            call.resolve(ret)
        } catch (e: Exception) {
            call.reject("Device discovery failed: ${e.message}", e)
        }
    }

    /**
     * Connects to a printer via specified transport and address.
     */
    @PluginMethod
    fun connect(call: PluginCall) {
        val transport = call.getString("transport") ?: return call.reject("Transport is required")
        val address = call.getString("address") ?: return call.reject("Address is required")

        try {
            when (transport) {
                "bluetooth" -> {
                    val btAdapter = BluetoothAdapter.getDefaultAdapter()
                        ?: return call.reject("Bluetooth is not available on this device")
                    val device = btAdapter.getRemoteDevice(address)
                    activeBtSocket?.close()
                    activeBtSocket = device.createRfcommSocketToServiceRecord(SPP_UUID)
                    activeBtSocket?.connect()
                    call.resolve(JSObject().put("connected", true))
                }
                "lan" -> {
                    val parts = address.split(":")
                    val host = parts[0]
                    val port = if (parts.size > 1) parts[1].toInt() else DEFAULT_LAN_PORT

                    activeTcpSocket?.close()
                    val socket = Socket()
                    socket.connect(InetSocketAddress(host, port), SOCKET_TIMEOUT_MS)
                    activeTcpSocket = socket
                    call.resolve(JSObject().put("connected", true))
                }
                "usb" -> {
                    val usbManager = context.getSystemService(Context.USB_SERVICE) as UsbManager
                    val device = usbManager.deviceList[address]
                        ?: return call.reject("USB device not found at address: $address")

                    var printerInterface: UsbInterface? = null
                    var endpointOut: UsbEndpoint? = null

                    for (i in 0 until device.interfaceCount) {
                        val iface = device.getInterface(i)
                        for (j in 0 until iface.endpointCount) {
                            val ep = iface.getEndpoint(j)
                            if (ep.direction == UsbConstants.USB_DIR_OUT) {
                                printerInterface = iface
                                endpointOut = ep
                                break
                            }
                        }
                        if (endpointOut != null) break
                    }

                    if (printerInterface == null || endpointOut == null) {
                        return call.reject("No writable endpoint found for USB device")
                    }

                    val connection = usbManager.openDevice(device)
                        ?: return call.reject("Failed to acquire permission/open USB device")

                    connection.claimInterface(printerInterface, true)
                    activeUsbConnection = connection
                    activeUsbEndpoint = endpointOut
                    call.resolve(JSObject().put("connected", true))
                }
                else -> {
                    call.reject("Unsupported transport: $transport")
                }
            }
        } catch (e: Exception) {
            call.reject("Connection failed: ${e.message}", e)
        }
    }

    /**
     * Transmits raw ESC/POS byte sequence (encoded as Base64).
     */
    @PluginMethod
    fun write(call: PluginCall) {
        val transport = call.getString("transport") ?: return call.reject("Transport is required")
        val address = call.getString("address") ?: ""
        val dataBase64 = call.getString("data") ?: return call.reject("Data is required")
        val bytes = Base64.decode(dataBase64, Base64.DEFAULT)

        try {
            when (transport) {
                "bluetooth" -> {
                    val socket = activeBtSocket
                        ?: return call.reject("Printer not connected over Bluetooth")
                    val outputStream: OutputStream = socket.outputStream
                    outputStream.write(bytes)
                    outputStream.flush()
                    call.resolve(JSObject().put("bytesWritten", bytes.size))
                }
                "lan" -> {
                    // One-shot or persistent socket connection
                    val socket = if (activeTcpSocket != null && activeTcpSocket!!.isConnected) {
                        activeTcpSocket!!
                    } else {
                        val parts = address.split(":")
                        val host = parts[0]
                        val port = if (parts.size > 1) parts[1].toInt() else DEFAULT_LAN_PORT
                        val s = Socket()
                        s.connect(InetSocketAddress(host, port), SOCKET_TIMEOUT_MS)
                        s
                    }
                    val outputStream = socket.getOutputStream()
                    outputStream.write(bytes)
                    outputStream.flush()
                    call.resolve(JSObject().put("bytesWritten", bytes.size))
                }
                "usb" -> {
                    val conn = activeUsbConnection
                        ?: return call.reject("Printer not connected over USB")
                    val ep = activeUsbEndpoint
                        ?: return call.reject("USB endpoint not initialized")
                    val written = conn.bulkTransfer(ep, bytes, bytes.size, SOCKET_TIMEOUT_MS)
                    if (written < 0) {
                        call.reject("USB bulkTransfer write failed ($written)")
                    } else {
                        call.resolve(JSObject().put("bytesWritten", written))
                    }
                }
                else -> {
                    call.reject("Unsupported transport: $transport")
                }
            }
        } catch (e: Exception) {
            call.reject("Write operation failed: ${e.message}", e)
        }
    }

    /**
     * Disconnects active socket or USB interface.
     */
    @PluginMethod
    fun disconnect(call: PluginCall) {
        try {
            activeBtSocket?.close()
            activeBtSocket = null
            activeTcpSocket?.close()
            activeTcpSocket = null
            activeUsbConnection?.close()
            activeUsbConnection = null
            activeUsbEndpoint = null
            call.resolve(JSObject().put("disconnected", true))
        } catch (e: Exception) {
            call.reject("Disconnect failed: ${e.message}", e)
        }
    }
}
