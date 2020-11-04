
<template>
  <div class='upload-file'>
    <div></div>
    <input type="file" @change="handleFileChange">
    <el-button type="primary" @click="uploadFile">上传</el-button>
    <el-button type="primary" v-if="!isPuased" @click="pause">暂停</el-button>
    <el-button type="primary" v-else @click="resume">恢复</el-button>
    <div class="upload-percentage" v-show="container.file">
      <li class="upload-percentage__all">
        <p>总进度</p>
        <el-progress :percentage="uploadPercentage"></el-progress>
      </li>
      <li class="upload-percentage__item" style="padding-bottom: 20px;margin-bottom: 20px;">
        <span>切片hash</span>
        <span>大小(KB)</span>
        <span>进度</span>
      </li>
      <li class="upload-percentage__item" v-for="item in data" :key=item.index>
        <span>{{item.hash}}</span>
        <span>{{parseInt(item.chunk.size/1024)}}</span>
        <el-progress :percentage="item.percentage" status="success"></el-progress>
      </li>

    </div>
  </div>
</template>

<script>
import axios from 'axios'
export default {
  props: {},
  data () {
    return {
      SIZE: 1024 * 1024 * 10,
      isPuase: false,
      container: {
        file: null,
        hash: null,
        worker: null
      },
      fileUploadList: [],
      data: [],
      uploadFileURL: "http://localhost:3000/uploadFile",
      mergeFileURL: "http://localhost:3000/merge",
      verifyFileURL: "http://localhost:3000/verify"
    };
  },
  computed: {
    uploadPercentage () {
      if (!this.container.file || !this.data.length) return 0
      const loaded = this.data
        .map(item => item.percentage * item.chunk.size)
        .reduce((acc, cue) => acc + cue)
      return parseInt((loaded / this.container.file.size).toFixed(2))
    }
  },
  watch: {},
  created () { },
  mounted () { },
  beforeDestroy () { },
  methods: {
    handleFileChange (e) {
      console.log(e)
      const [file] = e.target.files
      if (!file) return
      this.container.file = file
      this.container.fileChunks = null
      this.container.hash = null
    },
    // 恢复上传
    async resume () {
      this.isPuase = false
      await this.uploadFile()
    },
    // 暂停上传
    pause () {
      this.fileUploadList.forEach(item => item.abort())
      this.fileUploadList = []
      this.isPuase = true
    },
    // 上传文件
    async uploadFile () {
      // const formData = new FormData()
      // formData
      // axios.post('./uploadFile', this.container.file)
      if (!this.container.file) return
      // 未来如果根据网络波动来创建文件分块，这样可能会导致文件分块不一样，所以使用缓存。
      this.container.fileChunks = this.container.fileChunks || this.createFileChunks(this.container.file) // 生成文件分块
      // 因为计算hash值太费时，所以在未替换文件时，使用缓存的hash值
      this.container.hash = this.container.hash || await this.calculateFileHash(this.container.fileChunks) // 生成文件 hash 值

      // 上传前先校验服务端文件是否存在
      const { shouldUpload, uploadCacheList = [] } = await this.verifyUpload(
        this.container.file.name, this.container.hash
      )
      if (!shouldUpload) {
        this.$message.success('秒传：上传成功！')
        return
      }

      // this.data = fileChunks.filter(({ file }, index) => {
      //   return uploadCacheList.findIndex(hash => hash === (this.container.hash + '-' + index)) === -1
      // }).map(({ file }, index) => ({
      //   fileHash: this.container.hash,
      //   filename: this.container.file.name,
      //   chunk: file,
      //   index,
      //   hash: this.container.hash + '-' + index,
      //   percentage: 0
      // }))
      this.data = []
      for (let index = 0; index < this.container.fileChunks.length; index++) {
        if (uploadCacheList.findIndex(hash => hash === (this.container.hash + '-' + index)) === -1) {
          this.data.push({
            fileHash: this.container.hash,
            filename: this.container.file.name,
            chunk: this.container.fileChunks[index].file,
            index,
            hash: this.container.hash + '-' + index,
            percentage: 0
          })
        }
      }

      console.log('fileChunks: ', this.container.fileChunks)
      console.log('uploadCacheList: ', uploadCacheList)
      console.log('this.data: ', this.data.map(({ hash }) => hash))


      await this.uploadFileChunks()
    },
    // 上传前先校验服务端文件是否存在
    async verifyUpload (filename, fileHash) {
      const res = await this.request({
        url: this.verifyFileURL,
        headers: { 'content-type': 'application/json' },
        data: JSON.stringify({ filename, fileHash })
      })
      if (res.code === 200) {
        return { shouldUpload: res.shouldUpload, uploadCacheList: res.uploadCacheList }
      } else {
        this.$message.error('传输失败')
        return { shouldUpload: false, uploadCacheList: [] }
      }
    },
    // 生成文件 hash （利用web-worker）
    calculateFileHash (fileChunks) {
      return new Promise((resolve, reject) => {
        // 添加 worker
        try {
          this.container.worker = new Worker('static/utils/hash.js')
          this.container.worker.postMessage({ fileChunks })
          this.container.worker.onmessage = e => {
            const { percentage, hash } = e.data
            this.hashPercentage = percentage
            if (hash) {
              resolve(hash)
            }
          }
        } catch (e) {
          reject(e.toString())
        }
      })
    },
    // 上传分块文件
    async uploadFileChunks () {
      const requestList = this.data.map(({ chunk, hash, index, fileHash }) => {
        const formData = new FormData()
        formData.append('chunk', chunk)
        formData.append('hash', hash)
        formData.append('fileName', this.container.file.name)
        formData.append('fileHash', fileHash)
        return { formData, index }
      }).map(async ({ formData, index }) =>
        this.request({
          url: this.uploadFileURL,
          data: formData,
          onProgress: this.createProgressHandler(this.data[index]),
          requestList: this.fileUploadList
        })
      )
      await Promise.all(requestList)
      await this.mergeFileRequest()
    },
    // 发送合并文件请求
    async mergeFileRequest () {
      const res = await this.request({
        url: this.mergeFileURL,
        headers: { 'content-type': 'application/json' },
        data: JSON.stringify({
          filename: this.container.file.name,
          fileHash: this.container.hash,
          size: this.SIZE
        })
      })

      if (res.code === 200) {
        this.container.hash = null
        this.container.fileChunks = null
        this.$message.success('上传成功')
      } else {
        this.$message.error('上传失败')
      }

    },
    // progress事件工厂函数
    createProgressHandler (item) {
      return e => {
        item.percentage = parseInt(String(e.loaded / e.total) * 100)
      }
    },
    // 生成文件切片
    createFileChunks (file, size = this.SIZE) {
      const fileChunks = []
      let cur = 0
      while (cur < file.size) {
        fileChunks.push({ file: file.slice(cur, cur + this.SIZE) })
        cur += this.SIZE
      }
      return fileChunks
    },
    // 请求封装
    request ({ url, method = 'post', data, headers, onProgress = e => e, requestList }) {
      return new Promise((resolve, reject) => {
        try {
          // 创建xhr
          const xhr = new XMLHttpRequest()
          // 设置上传进度事件
          xhr.upload.onprogress = onProgress
          // 开启一个连接
          xhr.open(method, url)
          // 设置头信息
          for (const key in headers) {
            xhr.setRequestHeader(key, headers[key])
          }
          requestList && requestList.push(xhr)
          // 开始传输
          xhr.send(data)
          // 完成传输返回
          xhr.onload = e => {
            if (requestList) {
              // 请求成功的 xhr 从列表删除
              const index = requestList.findIndex(item => item === xhr)
              requestList.splice(index, 1)
            }
            resolve(JSON.parse(e.target.response))
          }
        } catch (e) {
          reject(e.toString())
        }
      })
    }

  },
  components: {},
}
</script>
<style lang="scss" scoped>
.upload-file {
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
</style>
