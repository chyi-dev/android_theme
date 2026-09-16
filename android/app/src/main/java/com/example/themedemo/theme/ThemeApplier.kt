package com.example.themedemo.theme

import android.graphics.BitmapFactory
import android.view.Window
import android.widget.ImageView
import android.widget.TextView
import androidx.appcompat.widget.Toolbar
import androidx.core.content.ContextCompat
import androidx.core.view.WindowCompat
import com.example.themedemo.R
import com.example.themedemo.databinding.ActivityMainBinding
import java.io.File

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
        val onBubble = ThemeColors.contrastOn(brand)

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
            binding.statusI18nSnapshot,
            binding.statusI18nSource,
            binding.statusLocale,
            binding.statusI18nError,
            binding.statusHint,
        ).forEach { it.setTextColor(text) }

        binding.refreshButton.setBackgroundColor(brand)
        binding.refreshButton.setTextColor(ThemeColors.contrastOn(brand))
        binding.bubbleShort.setTextColor(onBubble)
        binding.bubbleLong.setTextColor(onBubble)

        loadBitmapSlot(binding.bannerImage, theme, AssetSlots.HOME_BANNER)
        loadBitmapSlot(binding.logoImage, theme, AssetSlots.LOGO)
        applyNinePatchBackground(binding.bubbleShort, theme)
        applyNinePatchBackground(binding.bubbleLong, theme)
    }

    private fun loadBitmapSlot(view: ImageView, theme: AppliedTheme, slot: String) {
        val fallback = ThemeColors.builtinDrawable(slot)
        val file = theme.assets[slot]?.file
        if (file != null && file.exists()) {
            val bmp = BitmapFactory.decodeFile(file.absolutePath)
            if (bmp != null) {
                view.setImageBitmap(bmp)
                return
            }
        }
        view.setImageResource(fallback)
    }

    private fun applyNinePatchBackground(view: TextView, theme: AppliedTheme) {
        val file: File? = theme.assets[AssetSlots.CHAT_BUBBLE]?.file
        if (file != null && file.exists()) {
            val drawable = NinePatchLoader.loadFromFile(view.resources, file)
            if (drawable != null) {
                view.background = drawable
                return
            }
        }
        view.background = ContextCompat.getDrawable(view.context, R.drawable.chat_bubble)
    }
}
