package com.example.themedemo.theme

import android.graphics.Color
import com.example.themedemo.R
import org.json.JSONObject

object ThemeColors {
    fun parseHex(hex: String): Int? {
        val trimmed = hex.trim()
        if (trimmed.isEmpty()) return null
        val withHash = if (trimmed.startsWith("#")) trimmed else "#$trimmed"
        val body = withHash.substring(1)
        if (body.length != 6 && body.length != 8) return null
        if (body.any { it !in "0123456789abcdefABCDEF" }) return null
        return try {
            Color.parseColor(withHash)
        } catch (_: IllegalArgumentException) {
            null
        }
    }

    fun contrastOn(background: Int): Int {
        val r = Color.red(background) / 255.0
        val g = Color.green(background) / 255.0
        val b = Color.blue(background) / 255.0
        val luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
        return if (luminance > 0.6) Color.BLACK else Color.WHITE
    }

    fun builtinRes(token: String): Int = when (token) {
        ThemeTokens.BRAND_PRIMARY -> R.color.theme_brand_primary
        ThemeTokens.TEXT_PRIMARY -> R.color.theme_text_primary
        ThemeTokens.SURFACE -> R.color.theme_surface
        ThemeTokens.BACKGROUND -> R.color.theme_background
        else -> R.color.theme_background
    }

    fun builtinDrawable(slot: String): Int = when (slot) {
        AssetSlots.HOME_BANNER -> R.drawable.home_banner_default
        AssetSlots.LOGO -> R.drawable.logo_default
        AssetSlots.CHAT_BUBBLE -> R.drawable.chat_bubble
        else -> R.drawable.home_banner_default
    }
}

object ThemeParser {
    fun parse(json: String, source: ThemeSource): ThemeManifest {
        val root = JSONObject(json)
        val colorsObj = root.optJSONObject("colors") ?: JSONObject()
        val colors = mutableMapOf<String, String>()
        colorsObj.keys().forEach { key ->
            val value = colorsObj.opt(key)
            if (value is String) colors[key] = value
        }
        val assetsObj = root.optJSONObject("assets") ?: JSONObject()
        val assets = mutableMapOf<String, AssetRef>()
        assetsObj.keys().forEach { key ->
            val node = assetsObj.optJSONObject(key) ?: return@forEach
            val url = node.optString("url")
            if (url.isNotBlank()) {
                assets[key] = AssetRef(
                    url = url,
                    hash = node.optString("hash").ifBlank { null },
                    mime = node.optString("mime").ifBlank { null },
                    type = node.optString("type").ifBlank {
                        if (key == AssetSlots.CHAT_BUBBLE || url.contains(".9.")) ASSET_TYPE_NINEPATCH
                        else ASSET_TYPE_IMAGE
                    },
                )
            }
        }
        return ThemeManifest(
            schemaVersion = root.optInt("schemaVersion", 1),
            snapshotId = root.optString("snapshotId").ifBlank { "unknown" },
            publishedAt = root.optString("publishedAt").ifBlank { null },
            colors = colors,
            assets = assets,
            source = source,
            rawJson = json,
        )
    }
}
