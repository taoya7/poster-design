<template>
  <div id="page-design-index" ref="pageDesignIndex">
    <div class="page-design-index-wrap">
      <design-board class="page-design-wrap fixed-canvas" pageDesignCanvasId="page-design-canvas"></design-board>
    </div>
    <!-- 缩放控制 -->
    <zoom-control />
  </div>
</template>

<script lang="ts">
import { defineComponent, reactive, toRefs } from 'vue'
import { mapActions } from 'vuex'
import api from '@/api'
import wGroup from '@/components/modules/widgets/wGroup/wGroup.vue'
import Preload from '@/utils/plugins/preload'
import FontFaceObserver from 'fontfaceobserver'
import { blob2Base64, generateFontStyle } from '@/common/methods/fonts/utils'
import designBoard from '@/components/modules/layout/designBoard.vue'
import zoomControl from '@/components/modules/layout/zoomControl.vue'

export default defineComponent({
  components: { designBoard, zoomControl },
  // mixins: [shortcuts],
  setup() {
    const state = reactive({
      style: {
        left: '0px',
      },
    })

    return {
      ...toRefs(state),
    }
  },
  mounted() {
    this.initGroupJson(JSON.stringify(wGroup.setting))
    this.$nextTick(() => {
      this.load()
    })
  },
  methods: {
    ...mapActions(['initGroupJson', 'setTemplate']),
    async load() {
      let loadFlag = false
      const { id, tempid } = this.$route.query
      if (id || tempid) {
        const { data } = await api.home[id ? 'getWorks' : 'getTempDetail']({ id: id || tempid })
        const content = JSON.parse(data)

        content.page.backgroundImage && content.page.backgroundImage.split('.')[1] === 'palxp' && (content.page.backgroundImage += '@small')
        this.compressImages(content.widgets)
        this.$store.commit('setDPage', content.page)
        id ? this.$store.commit('setDWidgets', content.widgets) : this.setTemplate(content.widgets)
        await this.$nextTick()

        const imgsData: any = []
        const svgsData: any = []
        const fontLoaders: any = []
        const fontContent: any = {}
        let fontData: any = []
        content.widgets.forEach((item: any) => {
          if (item.fontClass && item.fontClass.value) {
            const loader = new FontFaceObserver(item.fontClass.value)
            fontData.push(item.fontClass)
            fontLoaders.push(loader.load())
            // 按字体来收集所有文字
            if (fontContent[item.fontClass.value]) {
              fontContent[item.fontClass.value] += item.text
            } else {
              fontContent[item.fontClass.value] = item.text
            }
          }
          // 收集图片元素、svg元素
          try {
            if (item.imgUrl && !item.isNinePatch) {
              const cNodes: any = (window as any).document.getElementById(item.uuid).childNodes
              for (const el of cNodes) {
                if (el.className === 'img__box') {
                  imgsData.push(el.firstChild)
                }
              }
            } else if (item.svgUrl) {
              const cNodes: any = (window as any).document.getElementById(item.uuid).childNodes
              svgsData.push(cNodes)
            }
          } catch (e) {}
        })

        try {
          const { list } = await api.material.getFonts({ ids: fontData.map((x: any) => x.id) })
          fontData.forEach((item: any) => {
            item.url = list.find((x: any) => x.oid == item.id).ttf
          })
          await this.font2style(fontContent, fontData)
          console.log('1. base64 yes')
          const preload = new Preload(imgsData)
          await preload.doms()
          console.log('2. image yes')
          const preload2 = new Preload(svgsData)
          await preload2.svgs()
          console.log('3. svg yes')
        } catch (e) {
          console.log(e)
        }
        try {
          await Promise.all(fontLoaders)
          console.log('4. font yes')
        } catch (e) {
          // console.log(e)
        }
        loadFlag = true
        console.log('--> now u can start screenshot!')
        setTimeout(() => {
          try {
            ;(window as any).loadFinishToInject('done')
          } catch (err) {}
        }, 100)
      }
      // 超时
      setTimeout(() => {
        !loadFlag && (window as any).loadFinishToInject('done')
      }, 60000)
    },
    async font2style(fontContent: any, fontData: any = []) {
      return new Promise((resolve: Function) => {
        Promise.all(
          // TODO: 临时。拿到所有文字所对应字体子集 base64
          Object.keys(fontContent).map(async (key) => {
            const font = fontData.find((font: any) => font.value === key) as any
            if (font.id) {
              try {
                const blob = await api.gaoding.getSubsetFont({
                  font_id: font.id,
                  url: font.url,
                  content: 'Aa' + fontContent[key],
                })
                const base64 = await blob2Base64(blob as unknown as Blob)
                fontContent[key] = base64
                console.log('获取稿定字体: ' + font.id)
              } catch (e) {
                console.log('字体获取失败', e)
              }
            }
          }),
        ).then(() => {
          const fontStyles = Object.keys(fontContent).reduce((pre, cur) => pre + generateFontStyle(cur, fontContent[cur]).outerHTML, '')
          document.head.innerHTML += fontStyles
          // document.head.appendChild(fontStyles)
          resolve()
        })
      })
    },
    compressImages(widgets: any) {
      // 自用
      for (const item of widgets) {
        if (item.imgUrl && item.imgUrl.split('.')[item.imgUrl.split('.').length - 1] === 'png') {
          item.imgUrl.split('.')[1] === 'palxp' && (item.imgUrl += '@small')
        }
      }
    },
  },
})
</script>

<style lang="less" scoped>
@import url('@/assets/styles/design.less');
.fixed-canvas {
  :deep(#page-design-canvas) {
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
  }
}
</style>
