package com.example.themedemo.i18n

import android.content.Context
import org.json.JSONObject
import java.io.File

class I18nStore(context: Context) {
    private val prefs = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    private val dir = File(context.applicationContext.filesDir, "i18n")
    private val manifestFile = File(dir, "last-good-manifest.json")
    private val shardsDir = File(dir, "shards")

    fun appLocale(): String = prefs.getString(KEY_LOCALE, I18nLocales.ZH_CN)?.trim().orEmpty()
        .ifBlank { I18nLocales.ZH_CN }

    fun setAppLocale(locale: String): String {
        val normalized = when {
            locale.startsWith("zh", ignoreCase = true) -> I18nLocales.ZH_CN
            else -> I18nLocales.EN
        }
        prefs.edit().putString(KEY_LOCALE, normalized).apply()
        return normalized
    }

    fun readManifestJson(): String? = readFile(manifestFile)

    fun saveManifestJson(json: String) {
        writeAtomic(manifestFile, json)
    }

    fun readShardJson(locale: String): String? = readFile(File(shardsDir, "$locale.json"))

    fun saveShardJson(locale: String, json: String) {
        writeAtomic(File(shardsDir, "$locale.json"), json)
    }

    fun listCachedLocales(): List<String> {
        if (!shardsDir.exists()) return emptyList()
        return shardsDir.listFiles()
            ?.filter { it.isFile && it.name.endsWith(".json") }
            ?.map { it.name.removeSuffix(".json") }
            .orEmpty()
    }

    fun loadCachedTables(): Map<String, Map<String, String>> {
        val out = mutableMapOf<String, Map<String, String>>()
        for (locale in listCachedLocales()) {
            val json = readShardJson(locale) ?: continue
            try {
                val (parsedLocale, messages) = I18nParser.parseShard(json)
                out[parsedLocale.ifBlank { locale }] = messages
            } catch (_: Exception) {
                try {
                    val obj = JSONObject(json)
                    val messages = mutableMapOf<String, String>()
                    obj.keys().forEach { key ->
                        val value = obj.opt(key)
                        if (value is String) messages[key] = value
                    }
                    if (messages.isNotEmpty()) out[locale] = messages
                } catch (_: Exception) {
                    // skip corrupt shard
                }
            }
        }
        return out
    }

    private fun readFile(file: File): String? {
        if (!file.exists()) return null
        return try {
            file.readText()
        } catch (_: Exception) {
            null
        }
    }

    private fun writeAtomic(file: File, json: String) {
        file.parentFile?.mkdirs()
        val tmp = File(file.parentFile, "${file.name}.tmp")
        tmp.writeText(json)
        if (!tmp.renameTo(file)) {
            file.writeText(json)
            tmp.delete()
        }
    }

    companion object {
        private const val PREFS = "theme_demo"
        private const val KEY_LOCALE = "app_locale"
    }
}
