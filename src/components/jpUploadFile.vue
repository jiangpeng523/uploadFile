<template>
  <div class="jp-upload-file">
    <el-upload action="#" :multiple="false" :show-file-list="false" :auto-upload="false" ref="upload" :on-change="handleChange">
      <el-button slot="trigger" type="primary">选取文件</el-button>
      <el-button style="margin-left: 10px;" type="success" @click="submitUpload">上传到服务器</el-button>
    </el-upload>
  </div>
</template>

<script>
import { uploadFile, mergeFile, verifyFile } from '../api/jpUploadFileApi.js'
export default {
  props: {},
  data () {
    return {
      SIZE: 1024 * 10, // 文件切块大小
      container: {
        file: null,
        hash: null,
        fileChunks: [],
        worker: null
      },
    };
  },
  computed: {},
  watch: {},
  created () { },
  mounted () { },
  beforeDestroy () { },
  methods: {
    handleChange (file) {
      this.container.file = file
    },
    submitUpload () {
      // todo
      // 1.文件分块
      if (!this.container.file) {
        this.$message.warning('请上传文件')
        return
      }
      this.container.fileChunks = this.createFileChunks(this.container.file)
      // 2.文件上传
    },
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
</style>
