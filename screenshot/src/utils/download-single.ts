/*
 * @Author: ShawnPhang
 * @Date: 2021-09-30 14:47:22
 * @Description: 下载图片（单浏览器版，适用于低配置服务器）
 * @LastEditors: ShawnPhang <site: book.palxp.com>
 * @LastEditTime: 2023-07-17 18:03:57
 */
const isDev = process.env.NODE_ENV === 'development'
const puppeteer = require('puppeteer')
const images = require('images')
const { executablePath } = require('../configs.ts')
const forceTimeOut = 60 // 强制超时时间，单位：秒

const saveScreenshot = async (url: string, { path, width, height, thumbPath, size = 0, quality = 0, prevent, ua, devices, scale, wait }: any) => {
  return new Promise(async (resolve: Function) => {
    // 启动浏览器
    const browser = await puppeteer.launch({
      headless: !isDev,
      executablePath: isDev ? null : executablePath,
      ignoreHTTPSErrors: true, // 忽略https安全提示
      args: ['–no-first-run', '–single-process', '–disable-gpu', '–no-zygote', '–disable-dev-shm-usage', '--no-sandbox', '--disable-setuid-sandbox', `--window-size=${width},${height}`], // 优化配置
      defaultViewport: null,
    })

    // 打开页面
    const page = await browser.newPage()
    // 设置浏览器视窗
    page.setViewport({
      width: Number(width),
      height: Number(height),
      deviceScaleFactor: !isNaN(scale) ? (+scale > 4 ? 4 : +scale) : 1,
    })
    ua && page.setUserAgent(ua)
    if (devices) {
      devices = puppeteer.devices[devices]
      devices && (await page.emulate(devices))
    }
    // 自动模式下页面加载完毕立即截图
    if (prevent === false) {
      page.on('load', async () => {
        await autoScroll()
        await sleep(wait)
        // await waitTillHTMLRendered(page)
        await page.screenshot({ path, fullPage: true })
        // 关闭浏览器
        await browser.close()
        compress()
        clearTimeout(regulators)
        resolve()
      })
    }
    // 主动模式下注入全局方法
    await page.exposeFunction('loadFinishToInject', async () => {
      // console.log('-> 开始截图')
      await page.screenshot({ path })
      // 关闭浏览器
      await browser.close()
      compress()
      // console.log('浏览器已释放');
      clearTimeout(regulators)
      resolve()
    })

    // 地址栏输入网页地址
    await page.goto(url, { waitUntil: 'domcontentloaded' })

    // 截图: https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md#pagescreenshotoptions
    const regulators = setTimeout(() => {
      browser && browser.close()
      console.log('强制释放浏览器')
      resolve()
    }, forceTimeOut * 1000)

    function compress() {
      // 压缩图片
      try {
        thumbPath &&
          images(path)
            .size(+size || 300)
            .save(thumbPath, { quality: +quality || 70 })
      } catch (err) {
        console.log(err)
      }
    }

    async function autoScroll() {
      await page.evaluate(async () => {
        await new Promise((resolve: any, reject: any) => {
          try {
            const maxScroll = Number.MAX_SAFE_INTEGER
            let lastScroll = 0
            const interval = setInterval(() => {
              window.scrollBy(0, 100)
              const scrollTop = document.documentElement.scrollTop || window.scrollY
              if (scrollTop === maxScroll || scrollTop === lastScroll) {
                clearInterval(interval)
                resolve()
              } else {
                lastScroll = scrollTop
              }
            }, 100)
          } catch (err) {
            console.log(err)
            reject(err)
          }
        })
      })
    }

    function sleep(timeout: number = 1) {
      return new Promise((resolve: any) => {
        setTimeout(() => {
          resolve()
        }, timeout)
      })
    }
  })
}

module.exports = { saveScreenshot }

export {}
