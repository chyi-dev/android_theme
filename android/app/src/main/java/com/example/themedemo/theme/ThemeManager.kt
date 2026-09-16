package com.example.themedemo.theme

import android.content.Context
import androidx.core.content.ContextCompat
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.Executors
import android.os.Handler
import android.os.Looper

fun interface ThemeListener {
    fun onThemeChanged(theme: AppliedTheme)
}

class ThemeManager(context: Context) {
    private val appContext = context.applicationContext
    private val store = ThemeStore(appContext)
    private val fetcher = ThemeFetcher()
    private val io = Executors.newSingleThreadExecutor()
    private val main = Handler(Looper.getMainLooper())
    private val listeners = CopyOnWriteArrayList<ThemeListener>()

    @Volatile
    var current: AppliedTheme = builtinTheme()
        private set

    fun baseUrl(): String = store.baseUrl()

    fun setBaseUrl(raw: String): String = store.setBaseUrl(raw)

    fun addListener(listener: ThemeListener) {
        listeners.add(listener)
        listener.onThemeChanged(current)
    }

    fun removeListener(listener: ThemeListener) {
        listeners.remove(listener)
    }

    fun loadLastGoodOrBuiltin() {
        val cached = store.readLastGoodJson()
        current = if (cached != null) {
            try {
                resolve(ThemeParser.parse(cached, ThemeSource.CACHE))
            } catch (_: Exception) {
                builtinTheme()
            }
        } else {
            builtinTheme()
        }
    }

    fun fetchAsync() {
        val url = store.baseUrl()
        io.execute {
            try {
                val json = fetcher.fetchManifestJson(url)
                val manifest = ThemeParser.parse(json, ThemeSource.NETWORK)
                val applied = resolve(manifest)
                store.saveLastGoodJson(json)
                publish(applied)
            } catch (err: Exception) {
                val message = err.message ?: err.javaClass.simpleName
                publish(current.copy(lastError = message))
            }
        }
    }

    private fun publish(theme: AppliedTheme) {
        main.post {
            current = theme
            listeners.forEach { it.onThemeChanged(theme) }
        }
    }

    private fun resolve(manifest: ThemeManifest): AppliedTheme {
        val colors = builtinColorMap().toMutableMap()
        for ((token, hex) in manifest.colors) {
            ThemeColors.parseHex(hex)?.let { colors[token] = it }
        }
        val urls = manifest.assets.mapValues { it.value.url }
        return AppliedTheme(
            snapshotId = manifest.snapshotId,
            source = manifest.source,
            publishedAt = manifest.publishedAt,
            colors = colors,
            assetUrls = urls,
            lastError = null,
        )
    }

    private fun builtinTheme(): AppliedTheme = AppliedTheme(
        snapshotId = "builtin",
        source = ThemeSource.BUILTIN,
        publishedAt = null,
        colors = builtinColorMap(),
        assetUrls = emptyMap(),
        lastError = null,
    )

    private fun builtinColorMap(): Map<String, Int> = ThemeTokens.ALL.associateWith { token ->
        ContextCompat.getColor(appContext, ThemeColors.builtinRes(token))
    }
}
