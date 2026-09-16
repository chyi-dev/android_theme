package com.example.themedemo.theme

import android.content.Context
import android.net.Uri
import java.io.File

class ThemeStore(context: Context) {
    private val prefs = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    private val lastGoodFile = File(context.applicationContext.filesDir, "theme/last-good.json")
    private val assetsDir = File(context.applicationContext.filesDir, "theme/assets")

    fun assetFileFor(hash: String?, url: String): File {
        val key = hash?.removePrefix("sha256:")?.take(40)
            ?: Integer.toHexString(url.hashCode())
        return File(assetsDir, key)
    }

    fun baseUrl(): String = prefs.getString(KEY_BASE_URL, DEFAULT_BASE_URL)?.trim()?.trimEnd('/')
        ?: DEFAULT_BASE_URL

    fun setBaseUrl(raw: String): String {
        val normalized = normalizeBaseUrl(raw)
        prefs.edit().putString(KEY_BASE_URL, normalized).apply()
        return normalized
    }

    fun readLastGoodJson(): String? {
        if (!lastGoodFile.exists()) return null
        return try {
            lastGoodFile.readText()
        } catch (_: Exception) {
            null
        }
    }

    fun saveLastGoodJson(json: String) {
        lastGoodFile.parentFile?.mkdirs()
        val tmp = File(lastGoodFile.parentFile, "last-good.json.tmp")
        tmp.writeText(json)
        if (!tmp.renameTo(lastGoodFile)) {
            lastGoodFile.writeText(json)
            tmp.delete()
        }
    }

    companion object {
        const val DEFAULT_BASE_URL = "http://10.0.2.2:8787"
        private const val PREFS = "theme_demo"
        private const val KEY_BASE_URL = "base_url"

        fun normalizeBaseUrl(raw: String): String {
            val trimmed = raw.trim().trimEnd('/')
            require(trimmed.isNotEmpty()) { "URL 不能为空" }
            val uri = Uri.parse(trimmed)
            val scheme = uri.scheme?.lowercase()
            require(scheme == "http" || scheme == "https") { "只支持 http / https" }
            require(!uri.host.isNullOrBlank()) { "缺少主机名" }
            return trimmed
        }
    }
}
