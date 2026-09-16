package com.example.themedemo.theme

import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.io.IOException
import java.util.concurrent.TimeUnit

class ThemeFetcher(
    private val client: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(8, TimeUnit.SECONDS)
        .readTimeout(8, TimeUnit.SECONDS)
        .callTimeout(12, TimeUnit.SECONDS)
        .build(),
) {
    fun fetchJson(url: String): String {
        val request = Request.Builder()
            .url(url)
            .header("Accept", "application/json")
            .get()
            .build()
        client.newCall(request).execute().use { response ->
            val body = response.body?.string().orEmpty()
            if (!response.isSuccessful) {
                throw IOException("HTTP ${response.code}: ${body.take(180)}")
            }
            if (body.isBlank()) throw IOException("empty body")
            return body
        }
    }

    fun fetchManifestJson(baseUrl: String): String =
        fetchJson("${baseUrl.trimEnd('/')}/v1/theme/manifest")

    fun fetchI18nManifestJson(baseUrl: String): String =
        fetchJson("${baseUrl.trimEnd('/')}/v1/i18n/manifest")

    fun downloadToFile(url: String, dest: File) {
        dest.parentFile?.mkdirs()
        val tmp = File(dest.parentFile, "${dest.name}.tmp")
        val request = Request.Builder().url(url).get().build()
        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) {
                tmp.delete()
                throw IOException("HTTP ${response.code} downloading $url")
            }
            val body = response.body ?: throw IOException("empty download")
            tmp.outputStream().use { out -> body.byteStream().copyTo(out) }
        }
        if (tmp.length() == 0L) {
            tmp.delete()
            throw IOException("empty download")
        }
        if (dest.exists()) dest.delete()
        if (!tmp.renameTo(dest)) {
            tmp.copyTo(dest, overwrite = true)
            tmp.delete()
        }
    }
}
