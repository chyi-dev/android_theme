package com.example.themedemo.i18n

import android.content.Context
import android.content.res.Configuration
import android.os.Handler
import android.os.Looper
import com.example.themedemo.R
import com.example.themedemo.theme.ThemeFetcher
import com.example.themedemo.theme.ThemeSource
import com.example.themedemo.theme.ThemeStore
import java.util.Locale
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.Executors

fun interface I18nListener {
    fun onCatalogChanged(catalog: AppliedCatalog)
}

class I18nManager(context: Context) {
    private val appContext = context.applicationContext
    private val themeStore = ThemeStore(appContext)
    private val store = I18nStore(appContext)
    private val fetcher = ThemeFetcher()
    private val io = Executors.newSingleThreadExecutor()
    private val main = Handler(Looper.getMainLooper())
    private val listeners = CopyOnWriteArrayList<I18nListener>()

    @Volatile
    var current: AppliedCatalog = builtinCatalog(store.appLocale())
        private set

    fun appLocale(): String = store.appLocale()

    fun addListener(listener: I18nListener) {
        listeners.add(listener)
        listener.onCatalogChanged(current)
    }

    fun removeListener(listener: I18nListener) {
        listeners.remove(listener)
    }

    fun t(key: String, args: Map<String, Any?> = emptyMap()): String {
        val raw = current.messages[key] ?: builtinMessage(key, current.requestedLocale)
        return I18nFormat.apply(raw, args)
    }

    fun loadLastGoodOrBuiltin() {
        val locale = store.appLocale()
        val cachedManifest = store.readManifestJson()
        val tables = store.loadCachedTables()
        current = if (cachedManifest != null && tables.isNotEmpty()) {
            try {
                val manifest = I18nParser.parseManifest(cachedManifest, ThemeSource.CACHE)
                resolve(manifest, tables, locale, lastError = null)
            } catch (_: Exception) {
                builtinCatalog(locale)
            }
        } else {
            builtinCatalog(locale)
        }
    }

    fun setAppLocale(locale: String) {
        val normalized = store.setAppLocale(locale)
        val cachedManifest = store.readManifestJson()
        val tables = store.loadCachedTables()
        current = if (cachedManifest != null && tables.isNotEmpty()) {
            try {
                val manifest = I18nParser.parseManifest(cachedManifest, ThemeSource.CACHE)
                resolve(manifest, tables, normalized, lastError = current.lastError)
            } catch (_: Exception) {
                builtinCatalog(normalized)
            }
        } else {
            builtinCatalog(normalized)
        }
        listeners.forEach { it.onCatalogChanged(current) }
    }

    fun fetchAsync(onDone: (() -> Unit)? = null) {
        val baseUrl = themeStore.baseUrl()
        val locale = store.appLocale()
        io.execute {
            try {
                val manifestJson = fetcher.fetchI18nManifestJson(baseUrl)
                val manifest = I18nParser.parseManifest(manifestJson, ThemeSource.NETWORK)
                val tables = linkedMapOf<String, Map<String, String>>()
                for (shard in manifest.shards) {
                    val body = fetcher.fetchJson(shard.url)
                    val (parsedLocale, messages) = I18nParser.parseShard(body)
                    val key = parsedLocale.ifBlank { shard.locale }
                    tables[key] = messages
                    store.saveShardJson(key, body)
                }
                store.saveManifestJson(manifestJson)
                publish(resolve(manifest, tables, locale, lastError = null), onDone)
            } catch (err: Exception) {
                val message = err.message ?: err.javaClass.simpleName
                publish(current.copy(lastError = message), onDone)
            }
        }
    }

    private fun publish(catalog: AppliedCatalog, onDone: (() -> Unit)? = null) {
        main.post {
            current = catalog
            listeners.forEach { it.onCatalogChanged(catalog) }
            onDone?.invoke()
        }
    }

    private fun resolve(
        manifest: I18nManifest,
        tables: Map<String, Map<String, String>>,
        requestedLocale: String,
        lastError: String?,
    ): AppliedCatalog {
        val candidates = I18nFormat.localeCandidates(requestedLocale, manifest.defaultLocale)
        val resolvedLocale = candidates.firstOrNull { tables.containsKey(it) }
        val remote = resolvedLocale?.let { tables[it] }.orEmpty()
        val builtin = builtinTable(requestedLocale)
        val merged = builtin.toMutableMap()
        merged.putAll(remote)
        return AppliedCatalog(
            snapshotId = if (resolvedLocale != null) manifest.snapshotId else "builtin",
            source = if (resolvedLocale != null) manifest.source else ThemeSource.BUILTIN,
            requestedLocale = requestedLocale,
            resolvedLocale = resolvedLocale ?: "builtin",
            publishedAt = manifest.publishedAt,
            messages = merged,
            lastError = lastError,
        )
    }

    private fun builtinCatalog(locale: String): AppliedCatalog = AppliedCatalog(
        snapshotId = "builtin",
        source = ThemeSource.BUILTIN,
        requestedLocale = locale,
        resolvedLocale = "builtin",
        publishedAt = null,
        messages = builtinTable(locale),
        lastError = null,
    )

    private fun builtinTable(locale: String): Map<String, String> {
        val ctx = localizedContext(locale)
        return mapOf(
            StringKeys.APP_TITLE to ctx.getString(R.string.app_name),
            StringKeys.HOME_WELCOME to ctx.getString(R.string.home_title),
            StringKeys.HOME_BODY to ctx.getString(R.string.home_body),
            StringKeys.ACTION_PULL to ctx.getString(R.string.pull_now),
            StringKeys.CHAT_SHORT to ctx.getString(R.string.chat_short),
            StringKeys.CHAT_BUBBLE to ctx.getString(R.string.chat_bubble),
        )
    }

    private fun builtinMessage(key: String, locale: String): String =
        builtinTable(locale)[key] ?: key

    private fun localizedContext(locale: String): Context {
        val loc = if (locale.startsWith("zh", ignoreCase = true)) {
            Locale.SIMPLIFIED_CHINESE
        } else {
            Locale.ENGLISH
        }
        val config = Configuration(appContext.resources.configuration)
        config.setLocale(loc)
        return appContext.createConfigurationContext(config)
    }
}
