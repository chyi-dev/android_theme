package com.example.themedemo.theme

import java.io.File

enum class ThemeSource {
    BUILTIN,
    CACHE,
    NETWORK,
}

object ThemeTokens {
    const val BRAND_PRIMARY = "brand.primary"
    const val TEXT_PRIMARY = "text.primary"
    const val SURFACE = "surface"
    const val BACKGROUND = "background"

    val ALL = listOf(BRAND_PRIMARY, TEXT_PRIMARY, SURFACE, BACKGROUND)
}

object AssetSlots {
    const val HOME_BANNER = "home.banner"
    const val LOGO = "logo"
    const val CHAT_BUBBLE = "chat.bubble"

    val ALL = listOf(HOME_BANNER, LOGO, CHAT_BUBBLE)
}

const val ASSET_TYPE_IMAGE = "image"
const val ASSET_TYPE_NINEPATCH = "ninepatch"

data class AssetRef(
    val url: String,
    val hash: String? = null,
    val mime: String? = null,
    val type: String = ASSET_TYPE_IMAGE,
)

data class AppliedAsset(
    val type: String,
    val file: File? = null,
    val url: String? = null,
)

data class ThemeManifest(
    val schemaVersion: Int,
    val snapshotId: String,
    val publishedAt: String?,
    val colors: Map<String, String>,
    val assets: Map<String, AssetRef>,
    val source: ThemeSource,
    val rawJson: String?,
)

data class AppliedTheme(
    val snapshotId: String,
    val source: ThemeSource,
    val publishedAt: String?,
    val colors: Map<String, Int>,
    val assets: Map<String, AppliedAsset>,
    val lastError: String? = null,
)
