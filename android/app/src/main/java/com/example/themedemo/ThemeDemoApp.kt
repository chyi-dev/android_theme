package com.example.themedemo

import android.app.Application
import com.example.themedemo.i18n.I18nManager
import com.example.themedemo.theme.ThemeManager

class ThemeDemoApp : Application() {
    lateinit var themeManager: ThemeManager
        private set
    lateinit var i18nManager: I18nManager
        private set

    override fun onCreate() {
        super.onCreate()
        instance = this
        themeManager = ThemeManager(this)
        i18nManager = I18nManager(this)
        themeManager.loadLastGoodOrBuiltin()
        i18nManager.loadLastGoodOrBuiltin()
    }

    companion object {
        lateinit var instance: ThemeDemoApp
            private set
    }
}
