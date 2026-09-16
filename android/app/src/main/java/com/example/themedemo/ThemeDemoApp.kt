package com.example.themedemo

import android.app.Application
import com.example.themedemo.theme.ThemeManager

class ThemeDemoApp : Application() {
    lateinit var themeManager: ThemeManager
        private set

    override fun onCreate() {
        super.onCreate()
        instance = this
        themeManager = ThemeManager(this)
        themeManager.loadLastGoodOrBuiltin()
    }

    companion object {
        lateinit var instance: ThemeDemoApp
            private set
    }
}
