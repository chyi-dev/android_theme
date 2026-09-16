package com.example.themedemo.theme

import android.content.Context
import androidx.core.content.ContextCompat
import android.os.Handler
import android.os.Looper
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.Executors

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
                resolve(ThemeParser.parse(cached, ThemeSource.CACHE), downloadMissing = false)
            } catch (_: Exception) {
                builtinTheme()
            }
        } else {
            builtinTheme()
        }
    }

    fun fetchAsync(onDone: (() -> Unit)? = null) {
        val url = store.baseUrl()
        io.execute {
            try {
                val json = fetcher.fetchManifestJson(url)
                val manifest = ThemeParser.parse(json, ThemeSource.NETWORK)
                val applied = resolve(manifest, downloadMissing = true)
                store.saveLastGoodJson(json)
                publish(applied, onDone)
            } catch (err: Exception) {
                val message = err.message ?: err.javaClass.simpleName
                publish(current.copy(lastError = message), onDone)
            }
        }
    }

    private fun publish(theme: AppliedTheme, onDone: (() -> Unit)? = null) {
        main.post {
            current = theme
            listeners.forEach { it.onThemeChanged(theme) }
            onDone?.invoke()
        }
    }

    private fun resolve(manifest: ThemeManifest, downloadMissing: Boolean): AppliedTheme {
        val colors = builtinColorMap().toMutableMap()
        for ((token, hex) in manifest.colors) {
            ThemeColors.parseHex(hex)?.let { colors[token] = it }
        }
        val assets = linkedMapOf<String, AppliedAsset>()
        for ((slot, ref) in manifest.assets) {
            val dest = store.assetFileFor(ref.hash, ref.url)
            if (downloadMissing && (!dest.exists() || dest.length() == 0L)) {
                fetcher.downloadToFile(ref.url, dest)
            }
            val file = dest.takeIf { it.exists() && it.length() > 0L }
            assets[slot] = AppliedAsset(type = ref.type, file = file, url = ref.url)
        }
        return AppliedTheme(
            snapshotId = manifest.snapshotId,
            source = manifest.source,
            publishedAt = manifest.publishedAt,
            colors = colors,
            assets = assets,
            lastError = null,
        )
    }

    private fun builtinTheme(): AppliedTheme = AppliedTheme(
        snapshotId = "builtin",
        source = ThemeSource.BUILTIN,
        publishedAt = null,
        colors = builtinColorMap(),
        assets = emptyMap(),
        lastError = null,
    )

    private fun builtinColorMap(): Map<String, Int> = ThemeTokens.ALL.associateWith { token ->
        ContextCompat.getColor(appContext, ThemeColors.builtinRes(token))
    }
}
