package com.example.themedemo.theme

import android.content.res.Resources
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Color
import android.graphics.NinePatch
import android.graphics.Rect
import android.graphics.drawable.BitmapDrawable
import android.graphics.drawable.Drawable
import android.graphics.drawable.NinePatchDrawable
import java.io.File
import java.nio.ByteBuffer
import java.nio.ByteOrder

/**
 * Loads a downloaded source `.9.png` (1px markers) as a real [NinePatchDrawable].
 * Compiled APK nine-patches already carry an `npTc` chunk; remote files usually do not,
 * so we parse the black stretch/padding markers ourselves.
 */
object NinePatchLoader {
    private const val NO_COLOR = 0x00000001

    fun loadFromFile(resources: Resources, file: File): Drawable? {
        val opts = BitmapFactory.Options().apply { inPreferredConfig = Bitmap.Config.ARGB_8888 }
        val bitmap = BitmapFactory.decodeFile(file.absolutePath, opts) ?: return null
        return fromBitmap(resources, bitmap, file.name.contains(".9."))
    }

    fun fromBitmap(resources: Resources, src: Bitmap, treatAsNine: Boolean): Drawable {
        val compiled = src.ninePatchChunk
        if (compiled != null && NinePatch.isNinePatchChunk(compiled)) {
            return NinePatchDrawable(resources, src, compiled, Rect(), null)
        }
        if (!treatAsNine && !hasMarkerBorder(src)) {
            return BitmapDrawable(resources, src)
        }
        val parsed = parseSourceNinePatch(src) ?: return BitmapDrawable(resources, src)
        return NinePatchDrawable(resources, parsed.bitmap, parsed.chunk, parsed.padding, null)
    }

    private fun hasMarkerBorder(src: Bitmap): Boolean {
        if (src.width < 3 || src.height < 3) return false
        for (x in 1 until src.width - 1) {
            if (isMarker(src.getPixel(x, 0))) return true
        }
        return false
    }

    private data class ParsedNine(
        val bitmap: Bitmap,
        val chunk: ByteArray,
        val padding: Rect,
    )

    private fun parseSourceNinePatch(src: Bitmap): ParsedNine? {
        val w = src.width
        val h = src.height
        if (w < 3 || h < 3) return null
        val contentW = w - 2
        val contentH = h - 2
        val xDivs = stretchDivs(contentW) { i -> isMarker(src.getPixel(i + 1, 0)) }
        val yDivs = stretchDivs(contentH) { i -> isMarker(src.getPixel(0, i + 1)) }
        if (xDivs.size < 2 || yDivs.size < 2) return null

        val padX = contentRange(contentW) { i -> isMarker(src.getPixel(i + 1, h - 1)) }
        val padY = contentRange(contentH) { i -> isMarker(src.getPixel(w - 1, i + 1)) }
        val padding = Rect(
            padX?.first ?: 0,
            padY?.first ?: 0,
            contentW - (padX?.second ?: contentW),
            contentH - (padY?.second ?: contentH),
        )
        val content = Bitmap.createBitmap(src, 1, 1, contentW, contentH)
        val chunk = buildChunk(xDivs, yDivs, padding)
        if (!NinePatch.isNinePatchChunk(chunk)) return null
        return ParsedNine(content, chunk, padding)
    }

    /** Black runs on the top/left border become [start, end) stretch pairs in content coordinates. */
    private fun stretchDivs(length: Int, isBlack: (Int) -> Boolean): IntArray {
        val out = ArrayList<Int>()
        var i = 0
        while (i < length) {
            if (!isBlack(i)) {
                i++
                continue
            }
            val start = i
            while (i < length && isBlack(i)) i++
            out.add(start)
            out.add(i)
        }
        return out.toIntArray()
    }

    private fun contentRange(length: Int, isBlack: (Int) -> Boolean): Pair<Int, Int>? {
        var start = -1
        var end = -1
        for (i in 0 until length) {
            if (!isBlack(i)) continue
            if (start < 0) start = i
            end = i + 1
        }
        if (start < 0) return null
        return start to end
    }

    private fun isMarker(pixel: Int): Boolean =
        Color.alpha(pixel) >= 250 && Color.red(pixel) == 0 && Color.green(pixel) == 0 && Color.blue(pixel) == 0

    private fun buildChunk(xDivs: IntArray, yDivs: IntArray, padding: Rect): ByteArray {
        val numColors = 9
        val header = 32
        val size = header + 4 * (xDivs.size + yDivs.size + numColors)
        val buf = ByteBuffer.allocate(size).order(ByteOrder.nativeOrder())
        buf.put(1.toByte())
        buf.put(xDivs.size.toByte())
        buf.put(yDivs.size.toByte())
        buf.put(numColors.toByte())
        val xOff = 32
        val yOff = xOff + xDivs.size * 4
        val cOff = yOff + yDivs.size * 4
        buf.putInt(xOff)
        buf.putInt(yOff)
        buf.putInt(padding.left)
        buf.putInt(padding.right)
        buf.putInt(padding.top)
        buf.putInt(padding.bottom)
        buf.putInt(cOff)
        xDivs.forEach { buf.putInt(it) }
        yDivs.forEach { buf.putInt(it) }
        repeat(numColors) { buf.putInt(NO_COLOR) }
        return buf.array()
    }
}
