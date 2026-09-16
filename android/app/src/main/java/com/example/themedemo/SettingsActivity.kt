package com.example.themedemo

import android.os.Bundle
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.example.themedemo.databinding.ActivitySettingsBinding
import com.example.themedemo.theme.ThemeApplier
import com.example.themedemo.theme.ThemeStore
import com.example.themedemo.theme.ThemeTokens

class SettingsActivity : AppCompatActivity() {
    private lateinit var binding: ActivitySettingsBinding
    private val themeManager get() = ThemeDemoApp.instance.themeManager

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivitySettingsBinding.inflate(layoutInflater)
        setContentView(binding.root)
        setSupportActionBar(binding.toolbar)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)
        binding.toolbar.setNavigationOnClickListener { finish() }

        val theme = themeManager.current
        val brand = theme.colors[ThemeTokens.BRAND_PRIMARY] ?: 0xFF1565C0.toInt()
        ThemeApplier.applyWindow(window, brand)
        ThemeApplier.applyToolbar(binding.toolbar, brand)
        binding.root.setBackgroundColor(theme.colors[ThemeTokens.BACKGROUND] ?: 0xFFF5F5F5.toInt())
        binding.baseUrlInput.setText(themeManager.baseUrl())

        binding.saveButton.setOnClickListener {
            try {
                val saved = themeManager.setBaseUrl(binding.baseUrlInput.text?.toString().orEmpty())
                binding.baseUrlInput.setText(saved)
                Toast.makeText(this, R.string.settings_saved, Toast.LENGTH_SHORT).show()
                finish()
            } catch (err: Exception) {
                Toast.makeText(this, err.message ?: getString(R.string.settings_invalid), Toast.LENGTH_LONG).show()
            }
        }

        binding.emulatorPreset.setOnClickListener {
            binding.baseUrlInput.setText(ThemeStore.DEFAULT_BASE_URL)
        }
    }
}
