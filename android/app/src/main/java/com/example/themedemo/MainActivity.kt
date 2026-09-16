package com.example.themedemo

import android.content.Intent
import android.os.Bundle
import android.view.Menu
import android.view.MenuItem
import androidx.appcompat.app.AppCompatActivity
import com.example.themedemo.databinding.ActivityMainBinding
import com.example.themedemo.theme.AppliedTheme
import com.example.themedemo.theme.ThemeApplier
import com.example.themedemo.theme.ThemeListener
import com.example.themedemo.theme.ThemeSource

class MainActivity : AppCompatActivity(), ThemeListener {
    private lateinit var binding: ActivityMainBinding
    private val themeManager get() = ThemeDemoApp.instance.themeManager

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)
        setSupportActionBar(binding.toolbar)

        binding.refreshButton.setOnClickListener { fetchNow() }
        binding.swipeRefresh.setOnRefreshListener { fetchNow() }

        ThemeApplier.applyMain(window, binding, themeManager.current)
        bindStatus(themeManager.current)
    }

    override fun onStart() {
        super.onStart()
        themeManager.addListener(this)
        fetchNow()
    }

    override fun onStop() {
        themeManager.removeListener(this)
        super.onStop()
    }

    override fun onThemeChanged(theme: AppliedTheme) {
        binding.swipeRefresh.isRefreshing = false
        ThemeApplier.applyMain(window, binding, theme)
        bindStatus(theme)
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
        themeManager.fetchAsync()
    }

    private fun bindStatus(theme: AppliedTheme) {
        val sourceLabel = when (theme.source) {
            ThemeSource.NETWORK -> "network"
            ThemeSource.CACHE -> "cache"
            ThemeSource.BUILTIN -> "builtin"
        }
        binding.statusSnapshot.text = getString(R.string.status_snapshot, theme.snapshotId)
        binding.statusSource.text = getString(R.string.status_source, sourceLabel)
        binding.statusPublished.text = getString(
            R.string.status_published,
            theme.publishedAt ?: "—"
        )
        binding.statusError.text = getString(
            R.string.status_error,
            theme.lastError ?: "无"
        )
        binding.statusHint.text = getString(R.string.status_base_url, themeManager.baseUrl())
    }
}
