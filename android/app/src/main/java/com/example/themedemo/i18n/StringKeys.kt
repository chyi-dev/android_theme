package com.example.themedemo.i18n

object StringKeys {
    const val APP_TITLE = "string.app.title"
    const val HOME_WELCOME = "string.home.welcome"
    const val HOME_BODY = "string.home.body"
    const val ACTION_PULL = "string.action.pull"
    const val CHAT_SHORT = "string.chat.short"
    const val CHAT_BUBBLE = "string.chat.bubble"

    const val DEMO_NAME = "Ada"

    val ALL = listOf(APP_TITLE, HOME_WELCOME, HOME_BODY, ACTION_PULL, CHAT_SHORT, CHAT_BUBBLE)
}

object I18nLocales {
    const val ZH_CN = "zh-CN"
    const val EN = "en"
    const val DEFAULT = EN
    val ALL = listOf(ZH_CN, EN)
}
