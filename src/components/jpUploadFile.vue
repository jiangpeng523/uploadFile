<template>
  <div class="jp-upload-file">
    <el-upload action="#" :multiple="false" :show-file-list="false" :auto-upload="false" ref="upload" :on-change="handleChange">
      <el-button slot="trigger" type="primary">选取文件</el-button>
      <el-button style="margin-left: 10px;" type="primary" @click="uploadFile">上传</el-button>
      <el-button type="primary" @click="changeStatus">{{!isPuased? '暂停' : '恢复'}}</el-button>
    </el-upload>
    <div class="upload-percentage" v-show="container.file">
      <li class="upload-percentage__all">
        <p>hash计算</p>
        <el-progress :percentage="hashPercentage"></el-progress>
      </li>
      <li class="upload-percentage__all">
        <p>总进度</p>
        <el-progress :percentage="uploadPercentage"></el-progress>
      </li>
      <!-- <li class="upload-percentage__item" style="padding-bottom: 20px;margin-bottom: 20px;">
        <span>切片hash</span>
        <span>大小(KB)</span>
        <span>进度</span>
      </li>
      <li class="upload-percentage__item" v-for="item in parmaList" :key=item.index>
        <span>{{item.hash}}</span>
        <span>{{parseInt(item.chunk.size/1024)}}</span>
        <el-progress :percentage="item.percentage" status="success"></el-progress>
      </li> -->
      <div class="cube-container" :style="{width:cubeWidth+'px',margin: 'auto'}">
        <div class="cube" v-for="item in parmaList" :key="item.hash">
          <div :class="{
            'uploading': item.percentage > 0 && item.percentage < 100,
            'success': item.percentage === 100
           }" :style="{
             'height': item.percentage + '%'
           }"></div>
          <i v-if="item.percentage>0&&item.percentage<100" class="el-icon-loading" style="color:#F56C6C;"></i>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
//{ uploadFile, mergeFile, verifyFile }
import jpUploadFileApi from '../api/jpUploadFileApi.js'
import axios from 'axios'
import { resolve, reject } from 'q';
export default {
  props: {},
  data () {
    return {
      cubeWidth: 200,
      SIZE: 1024 * 10 * 1024, // 文件切块大小
      isPuased: false, // 是否是暂停状态
      hashPercentage: 0, // 文件hash计算进度
      container: {
        file: null,
        hash: null,
        fileChunks: null,
        worker: null
      },
      parmaList: [], // 上传的参数组装以及进度
      Status: { // 上传状态值
        success: Symbol('success'),
        error: Symbol('error'),
        wait: Symbol('wait')
      }
    };
  },
  computed: {
    uploadPercentage () {
      if (!this.container.file || !this.parmaList.length) return 0
      const loaded = this.parmaList
        .map(item => item.percentage * item.chunk.size)
        .reduce((sum, next) => sum + next)
      return parseInt((loaded / this.container.file.size).toFixed(2))
    }
  },
  watch: {},
  created () { },
  mounted () { },
  beforeDestroy () { },
  methods: {
    handleChange (file) {
      // todo 这里可以去重，我选择了简单粗暴
      this.container.file = null
      this.container.hash = null
      this.container.fileChunks = null
      this.container.worker = null
      this.parmaList = []
      this.hashPercentage = 0
      this.container.file = file.raw // element 上传控件将原生的文件封装在 raw 属性中
    },
    changeStatus () {
      if (this.isPuased === false) {
        this.parmaList.forEach(({ cancel }) => cancel())
      } else {
        this.uploadFile()
      }
      this.isPuased = !this.isPuased
    },
    async uploadFile () {

      if (!this.container.file) {
        this.$message.warning('请上传文件')
        return
      }
      // 1.文件分块
      this.container.fileChunks = this.container.fileChunks || this.createFileChunks(this.container.file) // 这里是确定是不是暂停，有缓存
      // 2.上传之前先校验服务端文件是否存在，但校验文件是否存在需要确保文件有一个唯一的key
      // 所以这里根据文件内容计算hash值，这样就能得到文件的唯一key
      this.container.hash = this.container.hash || await this.calculateFileHash(this.container.fileChunks) // 计算文件hash值
      const { shouldUpload, uploadChunkList } = await this.verifyUpload(this.container.file.name, this.container.hash) // 校验文件是否存在还是上传了部分
      if (!shouldUpload) {
        this.$message.success('秒传成功！')
        return
      }
      // 3.文件上传
      this.parmaList = this.container.fileChunks.map((chunk, index) =>
        ({
          chunk: chunk.file,
          // hash: this.container.file.name + '-' + index,
          hash: this.container.hash + '-' + index,
          fileName: this.container.file.name,
          status: this.Status.wait,
          percentage: 0,
          cancel: null // 取消函数
        })
      ) // 组装上传的文件参数
      this.parmaList = this.parmaList.filter(param =>
        uploadChunkList.findIndex(item => item === param.hash) === -1
      ) // 过滤已经上传的文件，就剩下还需要上传的文件

      await this.uploadFileChunks()

    },
    // 计算文件内容的hash值，为什么要用分块的文件而不是整个文件直接计算是
    // 因为想得到计算的进度，而spark-md5插件没提供计算的进度。
    async calculateFileHash (fileChunks) {
      return new Promise((resolve, reject) => {
        try {
          this.container.worker = new Worker('static/utils/hash.js') // 创建worker子线程进行hash计算，避免阻塞主线程
          this.container.worker.postMessage({ fileChunks }) // 发送分块文件数据进行启动
          this.container.worker.onmessage = e => { // 接收worker线程发送回的数据
            const { percentage, hash } = e.data // 返回进度以及hash值
            this.hashPercentage = percentage
            if (hash) { // 如果hash有了，说明已经计算完毕
              resolve(hash)
            }
          }
        } catch (e) {
          reject(e.toSring())
        }
      })
    },
    // progress事件工厂函数
    createProgressHandler (item) {
      return e => {
        item.percentage = parseInt(String(e.loaded / e.total) * 100)
      }
    },
    // Axios token 取消请求工厂函数
    createCancelHandler (item) {
      // 看Axios官方Api找到的。可以使用同一个 cancel token 取消多个请求，我没去实验

      // 使用 CancelToken.source 工厂方法创建 cancel token
      const CancelToken = axios.CancelToken
      const source = CancelToken.source()
      item.cancel = source.cancel
      return source.token
    },
    // 校验服务器端文件是否存在请求，返回是否需要上传以及以及存在的切片文件列表
    async verifyUpload () {
      const params = {
        fileName: this.container.file.name,
        hash: this.container.hash
      }
      const res = await jpUploadFileApi.verifyFile(params)
      if (res.data.code === 200) {
        const { shouldUpload, uploadChunkList } = res.data
        return { shouldUpload, uploadChunkList }
      } else {
        this.$message.error('校验失败')
        return { shouldUpload: false, uploadChunkList: [] }
      }
    },
    // 上传分块文件
    async uploadFileChunks (formData, onUploadProgress, cancelToken) {
      // const requestList = this.parmaList.map(({ chunk, hash, fileName }, index) => {
      //   const formData = new FormData()
      //   formData.append('chunk', chunk)
      //   formData.append('hash', hash)
      //   formData.append('fileName', fileName)
      //   const onUploadProgress = this.createProgressHandler(this.parmaList[index])
      //   const cancelToken = this.createCancelHandler(this.parmaList[index])
      //   return { formData, onUploadProgress, cancelToken } // 组装上传的参数以及通过进度工厂函数为每一个分块文件创建一个进度函数
      // }).map(async ({ formData, onUploadProgress, cancelToken }) => {
      //   return await jpUploadFileApi.uploadFile(formData, onUploadProgress, cancelToken)
      // })
      // await Promise.all(requestList)

      const list = this.parmaList.map(({ chunk, hash, fileName }, index) => {
        const formData = new FormData()
        formData.append('chunk', chunk)
        formData.append('hash', hash)
        formData.append('fileName', fileName)
        const onUploadProgress = this.createProgressHandler(this.parmaList[index])
        const cancelToken = this.createCancelHandler(this.parmaList[index])
        return { formData, onUploadProgress, cancelToken, param: this.parmaList[index] } // 组装上传的参数以及通过进度工厂函数为每一个分块文件创建一个进度函数和取消函数
      })

      await this.sendRequest(list, 4) // 控制上传的并发数，上传分块文件

      // 4.合并文件
      await this.mergeFileRequest()
    },
    /**
     * 控制并发数上传文件
     * list: 上传的参数数组
     * limit: 最大并发数
     */
    async sendRequest (list, limit = 4) {
      return new Promise((resolve, reject) => {
        const len = list.length,
          errorList = new Array(list.length).fill(0)
        let counter = 0,
          curIndex = 0,
          errIndex = -1
        const start = async () => {
          while (counter < len && limit > 0 && !this.isPuased) {
            console.log('gogogog')
            limit-- // 占用通道
            errIndex = list.findIndex(item => item.param.status === this.Status.error)
            const index = errIndex > -1 ? errIndex : curIndex++
            console.log('index ', index)
            if (!list[index]) return
            const { formData, onUploadProgress, cancelToken } = list[index]
            jpUploadFileApi.uploadFile(formData, onUploadProgress, cancelToken)
              .then(res => {
                limit++
                if (res.data.code === 200) {
                  counter++
                  list[index].param.status = this.Status.success
                } else {
                  list[index].param.status = this.Status.error
                  errorList[index]++
                  list[index].param.percentage = 0
                  if (errorList[index] === 3) { // 一个请求报错三次
                    reject()
                  }
                }
                if (len === counter) {
                  resolve()
                } else {
                  start()
                }
              })
          }
        }
        start()
      })

    },
    // 发送合并请求
    async mergeFileRequest () {
      const params = {
        fileName: this.container.file.name,
        hash: this.container.hash,
        size: this.SIZE
      }
      const res = await jpUploadFileApi.mergeFile(params)
      if (res.data.code === 200) { // 合并完成清空各项数据
        this.container.file = null
        this.container.hash = null
        this.container.fileChunks = null
        this.container.worker = null
        this.parmaList = []
        this.hashPercentage = 0
        this.$message.success('上传成功！')
      } else {
        this.$message.error(res.data.message)
      }
    },
    // 创建指定大小的文件分块, 因为是按照顺序push进去的，所以返回的list的内容也是顺序的
    createFileChunks (file, size = this.SIZE) {
      const fileChunks = []
      let cur = 0
      while (cur < file.size) {
        const fileChunk = file.slice(cur, cur + size)
        fileChunks.push({ file: fileChunk })
        cur += size
      }
      return fileChunks
    }
  },
  components: {},
}
</script>
<style lang='scss' scoped>
//@import url(); 引入公共css类
.jp-upload-file {
  li {
    list-style: none;
  }
}
.upload-percentage__all {
  text-align: left;
  font-size: 22px;
  p {
    margin: 0;
  }
}
.upload-percentage__item {
  display: flex;
  justify-content: space-between;
  div,
  span {
    width: 33%;
    line-height: 22px;
  }
  padding: 8px 20px;
  border-bottom: 1px solid rgb(202, 200, 200);
}
.cube-container {
  width: 100px;
  overflow: hidden;
}

.cube {
  width: 14px;
  height: 14px;
  line-height: 12px;
  border: 1px solid black;
  background: #eee;
  float: left;
  .success {
    background: #67c23a;
  }
  .uploading {
    background: #409eff;
  }
}
</style>
