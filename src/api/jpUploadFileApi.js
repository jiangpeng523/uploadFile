import axios from './index.js'

const HostName = 'localhost:3000/api/'
// 上传文件
const uploadFile = param =>
  axios.get(HostName + 'uploadFile', param)
// 合并文件
const mergeFile = param =>
  axios.get(HostName + 'merge', param)
// 校验文件
const verifyFile = param =>
  axios.get(HostName + 'verify', param)

export default {
  uploadFile,
  mergeFile,
  verifyFile
}
