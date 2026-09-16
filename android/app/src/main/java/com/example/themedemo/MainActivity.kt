package com.example.themedemo

import android.content.Intent
import android.os.Bundle
import android.view.Menu
import android.view.MenuItem
import androidx.appcompat.app.AppCompatActivity
import com.example.themedemo.databinding.ActivityMainBinding
import com.example.themedemo.i18n.AppliedCatalog
import com.example.themedemo.i18n.I18nListener
import com.example.themedemo.i18n.I18nLocales
import com.example.themedemo.i18n.StringKeys
import com.example.themedemo.theme.AppliedTheme
import com.example.themedemo.theme.ThemeApplier
import com.example.themedemo.theme.ThemeListener
import com.example.themedemo.theme.ThemeSource

class MainActivity : AppCompatActivity(), ThemeListener, I18nListener {
    private lateinit var binding: ActivityMainBinding
    private val themeManager get() = ThemeDemoApp.instance.themeManager
    private val i18nManager get() = ThemeDemoApp.instance.i18nManager
    private var fetchGeneration = 0
    private var ignoreLocaleToggle = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)
        setSupportActionBar(binding.toolbar)

        binding.refreshButton.setOnClickListener { fetchNow() }
        binding.swipeRefresh.setOnRefreshListener { fetchNow() }
        binding.localeGroup.addOnButtonCheckedListener { _, checkedId, isChecked ->
            if (!isChecked || ignoreLocaleToggle) return@addOnButtonCheckedListener
            val locale = if (checkedId == R.id.localeZh) I18nLocales.ZH_CN else I18nLocales.EN
            if (locale == i18nManager.appLocale()) return@addOnButtonCheckedListener
            i18nManager.setAppLocale(locale)
            fetchNow()
        }

        ThemeApplier.applyMain(window, binding, themeManager.current)
        syncLocaleToggle()
        bindCopy()
        bindStatus()
    }

    override fun onStart() {
        super.onStart()
        themeManager.addListener(this)
        i18nManager.addListener(this)
        fetchNow()
    }

    override fun onStop() {
        themeManager.removeListener(this)
        i18nManager.removeListener(this)
        super.onStop()
    }

    override fun onThemeChanged(theme: AppliedTheme) {
        ThemeApplier.applyMain(window, binding, theme)
        bindCopy()
        bindStatus()
    }

    override fun onCatalogChanged(catalog: AppliedCatalog) {
        syncLocaleToggle()
        bindCopy()
        bindStatus()
    }

    override fun onCreateOptionsMenu(menu: Menu): Boolean {
        menuInflater.inflate(R.menu.main_menu, menu)
        return true
    }

    override fun onOptionsItemSelected(item: MenuItem): Boolean {
        if (item.itemId == R.id.action_settings) {
            startActivity(Intent(this, SettingsActivity::class.java))
            return true
        }
        if (item.itemId == R.id.action_refresh) {
            fetchNow()
            return true
        }
        return super.onOptionsItemSelected(item)
    }

    private fun fetchNow() {
        binding.swipeRefresh.isRefreshing = true
        val generation = ++fetchGeneration
        var remaining = 2
        val done = {
            if (generation == fetchGeneration) {
                remaining -= 1
                if (remaining <= 0) {
                    binding.swipeRefresh.isRefreshing = false
                }
            }
        }
        themeManager.fetchAsync(done)
        i18nManager.fetchAsync(done)
    }

    private fun bindCopy() {
        val i18n = i18nManager
        val title = i18n.t(StringKeys.APP_TITLE)
        binding.toolbar.title = title
        supportActionBar?.title = title
        binding.titleText.text = i18n.t(StringKeys.HOME_WELCOME, mapOf("name" to StringKeys.DEMO_NAME))
        binding.bodyText.text = i18n.t(StringKeys.HOME_BODY)
        binding.bubbleShort.text = i18n.t(StringKeys.CHAT_SHORT)
        binding.bubbleLong.text = i18n.t(StringKeys.CHAT_BUBBLE)
        binding.refreshButton.text = i18n.t(StringKeys.ACTION_PULL)
    }

    private fun bindStatus() {
        val theme = themeManager.current
        val catalog = i18nManager.current
        binding.statusSnapshot.text = getString(R.string.status_snapshot, theme.snapshotId)
        binding.statusSource.text = getString(R.string.status_source, sourceLabel(theme.source))
        binding.statusPublished.text = getString(R.string.status_published, theme.publishedAt ?: "—")
        binding.statusError.text = getString(R.string.status_error, theme.lastError ?: "无")
        binding.statusI18nSnapshot.text = getString(R.string.status_i18n_snapshot, catalog.snapshotId)
        binding.statusI18nSource.text = getString(R.string.status_i18n_source, sourceLabel(catalog.source))
        binding.statusLocale.text = getString(
            R.string.status_locale,
            "${catalog.requestedLocale} → ${catalog.resolvedLocale}"
        )
        binding.statusI18nError.text = getString(R.string.status_i18n_error, catalog.lastError ?: "无")
        val render = when {
            theme.source == ThemeSource.BUILTIN -> "builtin drawables + strings.xml"
            else -> "local cache (no network needed to paint)"
        }
        binding.statusHint.text = getString(R.string.status_render, render) + "\n" +
            getString(R.string.status_base_url, themeManager.baseUrl())
    }

    private fun syncLocaleToggle() {
        val locale = i18nManager.appLocale()
        val id = if (locale == I18nLocales.EN) R.id.localeEn else R.id.localeZh
        ignoreLocaleToggle = true
        binding.localeGroup.check(id)
        ignoreLocaleToggle = false
    }

    private fun sourceLabel(source: ThemeSource): String = when (source) {
        ThemeSource.NETWORK -> "network"
        ThemeSource.CACHE -> "cache"
        ThemeSource.BUILTIN -> "builtin"
    }
}
