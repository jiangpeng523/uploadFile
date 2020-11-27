import axios from './index.js'

const HostName = ''
// 上传文件
const uploadFile = (param, onUploadProgress, cancelToken) =>
  axios.post(HostName + 'uploadFile', param, { onUploadProgress, cancelToken })
// 合并文件
const mergeFile = param =>
  axios.post(HostName + 'merge', param)
// 校验文件
const verifyFile = param =>
  axios.post(HostName + 'verify', param)
const testCancel = (param, { onUploadProgress, cancelToken }) =>
  axios.post(HostName + 'testCancel', param, { onUploadProgress, cancelToken })
export default {
  uploadFile,
  mergeFile,
  verifyFile,
  testCancel
}
