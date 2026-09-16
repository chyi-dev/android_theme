package com.example.themedemo.theme

import android.view.Window
import android.widget.ImageView
import android.widget.TextView
import androidx.appcompat.widget.Toolbar
import androidx.core.view.WindowCompat
import coil.load
import com.example.themedemo.databinding.ActivityMainBinding

object ThemeApplier {
    fun applyWindow(window: Window, brand: Int) {
        window.statusBarColor = brand
        WindowCompat.getInsetsController(window, window.decorView)
            .isAppearanceLightStatusBars = ThemeColors.contrastOn(brand) == android.graphics.Color.BLACK
    }

    fun applyToolbar(toolbar: Toolbar, brand: Int) {
        val onBrand = ThemeColors.contrastOn(brand)
        toolbar.setBackgroundColor(brand)
        toolbar.setTitleTextColor(onBrand)
        toolbar.setSubtitleTextColor(onBrand)
        toolbar.navigationIcon?.setTint(onBrand)
        toolbar.overflowIcon?.setTint(onBrand)
    }

    fun applyMain(window: Window, binding: ActivityMainBinding, theme: AppliedTheme) {
        val brand = theme.colors[ThemeTokens.BRAND_PRIMARY] ?: 0xFF1565C0.toInt()
        val text = theme.colors[ThemeTokens.TEXT_PRIMARY] ?: 0xFF212121.toInt()
        val surface = theme.colors[ThemeTokens.SURFACE] ?: 0xFFFFFFFF.toInt()
        val background = theme.colors[ThemeTokens.BACKGROUND] ?: 0xFFF5F5F5.toInt()

        applyWindow(window, brand)
        applyToolbar(binding.toolbar, brand)
        binding.root.setBackgroundColor(background)
        binding.scroll.setBackgroundColor(background)
        binding.surfaceCard.setCardBackgroundColor(surface)
        binding.statusCard.setCardBackgroundColor(surface)

        listOf<TextView>(
            binding.titleText,
            binding.bodyText,
            binding.statusSnapshot,
            binding.statusSource,
            binding.statusPublished,
            binding.statusError,
            binding.statusHint,
        ).forEach { it.setTextColor(text) }

        binding.refreshButton.setBackgroundColor(brand)
        binding.refreshButton.setTextColor(ThemeColors.contrastOn(brand))

        loadSlot(binding.bannerImage, theme, AssetSlots.HOME_BANNER)
        loadSlot(binding.logoImage, theme, AssetSlots.LOGO)
    }

    private fun loadSlot(view: ImageView, theme: AppliedTheme, slot: String) {
        val url = theme.assetUrls[slot]
        val fallback = ThemeColors.builtinDrawable(slot)
        if (url.isNullOrBlank()) {
            view.setImageResource(fallback)
            return
        }
        view.load(url) {
            placeholder(fallback)
            error(fallback)
            crossfade(true)
        }
    }
}
