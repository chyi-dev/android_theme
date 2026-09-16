package com.example.themedemo.i18n

import com.example.themedemo.theme.ThemeSource

data class I18nShardRef(
    val locale: String,
    val url: String,
    val hash: String? = null,
)

data class I18nManifest(
    val schemaVersion: Int,
    val snapshotId: String,
    val publishedAt: String?,
    val defaultLocale: String,
    val shards: List<I18nShardRef>,
    val source: ThemeSource,
    val rawJson: String?,
)

data class AppliedCatalog(
    val snapshotId: String,
    val source: ThemeSource,
    val requestedLocale: String,
    val resolvedLocale: String,
    val publishedAt: String?,
    val messages: Map<String, String>,
    val lastError: String? = null,
)
