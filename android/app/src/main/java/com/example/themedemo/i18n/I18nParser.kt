package com.example.themedemo.i18n

import com.example.themedemo.theme.ThemeSource
import org.json.JSONObject

object I18nFormat {
    fun apply(template: String, args: Map<String, Any?> = emptyMap()): String {
        var out = template
        for ((key, value) in args) {
            out = out.replace("{$key}", value?.toString() ?: "")
        }
        return out
    }

    fun localeCandidates(locale: String, defaultLocale: String): List<String> {
        val out = linkedSetOf<String>()
        val trimmed = locale.trim()
        if (trimmed.isNotEmpty()) out.add(trimmed)
        val dash = trimmed.indexOf('-')
        if (dash > 0) out.add(trimmed.substring(0, dash))
        if (defaultLocale.isNotBlank()) out.add(defaultLocale)
        out.add(I18nLocales.EN)
        return out.toList()
    }
}

object I18nParser {
    fun parseManifest(json: String, source: ThemeSource): I18nManifest {
        val root = JSONObject(json)
        val shardsJson = root.optJSONArray("shards")
        val shards = mutableListOf<I18nShardRef>()
        if (shardsJson != null) {
            for (i in 0 until shardsJson.length()) {
                val node = shardsJson.optJSONObject(i) ?: continue
                val locale = node.optString("locale")
                val url = node.optString("url")
                if (locale.isBlank() || url.isBlank()) continue
                shards.add(
                    I18nShardRef(
                        locale = locale,
                        url = url,
                        hash = node.optString("hash").ifBlank { null },
                    )
                )
            }
        }
        return I18nManifest(
            schemaVersion = root.optInt("schemaVersion", 1),
            snapshotId = root.optString("i18nSnapshotId").ifBlank { "unknown" },
            publishedAt = root.optString("publishedAt").ifBlank { null },
            defaultLocale = root.optString("defaultLocale").ifBlank { I18nLocales.DEFAULT },
            shards = shards,
            source = source,
            rawJson = json,
        )
    }

    fun parseShard(json: String): Pair<String, Map<String, String>> {
        val root = JSONObject(json)
        val locale = root.optString("locale")
        val messagesObj = root.optJSONObject("messages") ?: JSONObject()
        val messages = mutableMapOf<String, String>()
        messagesObj.keys().forEach { key ->
            val value = messagesObj.opt(key)
            when (value) {
                is String -> messages[key] = value
                is JSONObject -> {
                    val text = value.optString("value")
                    if (text.isNotEmpty()) messages[key] = text
                }
            }
        }
        return locale to messages
    }
}
