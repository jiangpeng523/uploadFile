const http = require('http')
const path = require('path')
const fse = require('fs-extra') // 操作文件
const multiparty = require('multiparty')// 使用 multiparty 包处理前端传来的 FormData
const qs = require('qs') // 用来处理被序列化为url形式的参数
const server = http.createServer()
const UPLOAD_DIR = path.resolve(__dirname, '..', 'downloads') // 文件存储目录

// 提取文件名后缀的方法
const extractExt = fileName => 
  fileName.slice(fileName.lastIndexOf('.'),fileName.length)

// 用于接收post请求发送的数据的工具函数，研究半天才弄出来，哈哈哈哈哈哈
const resolvePost = req => (
  new Promise(resolve => {
    let chunk = ""
    req.on("data", data => { // 获取请求上传的数据或参数
      console.log('data')
      chunk += data;
    })
    req.on("end", () => {
      const { param } = qs.parse(chunk)
      resolve(JSON.parse(param)); // 返回接收的参数
    })
  })
)
  
server.on('request', async (req, res) => {
  // 服务端设置允许跨 因为我在vue中使用代理了，所以这里可以不用设置
  //res.setHeader('Access-Control-Allow-Origin', '*'); 
  //res.setHeader('Access-control-Allow-Headers', '*')

  if(req.method === 'OPTIONS') {
    res.status = 200
    res.end()
    return
  }
  const [url, params] = req.url.split('?')
  switch(url) {
    case '/uploadFile':
      uploadFile(req,res) // 对上传文件进行处理
      break
    case '/merge':
      merge(req, res)
      break
    case '/verify':
      verify(req, res)
      break
  }
})

async function verify (req, res) {
  const data = await resolvePost(req)
  const {fileName, hash} = data
  // const filePath = path.resolve(UPLOAD_DIR, fileName) // 目标文件的路径
  const filePath = path.resolve(UPLOAD_DIR, `${hash}${extractExt(fileName)}`) // 目标文件的路径
  let shouldUpload = true, uploadChunkList = []
  if(fse.existsSync(filePath)) {
    shouldUpload = false
  } else {
    // const dirName = fileName.replace(extractExt(fileName), '') // 存放切片文件的文件夹名称
    const dirName = hash // 存放切片文件的文件夹名称
    const chunkDir = path.resolve(UPLOAD_DIR, dirName) // 得到存放切片文件的路径
    if(fse.existsSync(chunkDir)) { // 判断是否存在该文件夹
      uploadChunkList = fse.readdirSync(chunkDir) // 读取到已经存在的文件名称List
    }
  }
  res.end(
    JSON.stringify({
      code: 200,
      shouldUpload,
      uploadChunkList
    })
  )
}

/**
 * 合并切片文件
 * @param {*} req
 * @param {*} res
 */
async function merge (req, res) {
  const data = await resolvePost(req)
  const {fileName, hash, size} = data // 因为现在没有做文件的唯一处理，所以现在用的文件名作为唯一标识
  // const filePath = path.resolve(UPLOAD_DIR, `${fileName}`) // 目标文件的路径
  const filePath = path.resolve(UPLOAD_DIR, `${hash}${extractExt(fileName)}`) // 目标文件的路径
  const chunkDir = filePath.replace(extractExt(fileName), '') // 切片存放文件夹的路径
  const chunkNameList = fse.readdirSync(chunkDir);
  chunkNameList.sort((a, b) => a.split("-")[1] - b.split("-")[1]); // 因为文件名字是 xxx-1 xxx-2，为了按顺序读入，所以就需要排序
  await Promise.all(
    chunkNameList.map((chunkName, index) => {
      const chunkPath = path.resolve(chunkDir, chunkName) // 文件夹与名字组成完整的文件路径
      const readStream = fse.createReadStream(chunkPath) // 创建读取流
      const writeStream  = fse.createWriteStream(filePath, {
        start: index * size,
        end: (index + 1) * size
      }) // 创建写入流, 并指定要写入的位置
      return new Promise(resolve => {
        // 读取完之后就将切片文件删除
        readStream.on('end', () => {
          fse.unlinkSync(chunkPath)
          resolve()
        })
        readStream.pipe(writeStream) // 通过管道将读取写入流对接
      })
    })
  )
  fse.rmdirSync(chunkDir) // 删除用来存放临时切片文件的文件夹

  res.end(
    JSON.stringify({
      code: 200,
      message: 'file merged success'
    })
  )
}


/**
 * 处理上传的文件切片
 * @param {*} req
 * @param {*} res
 */
function uploadFile(req,res) {
  const multipart = new multiparty.Form()
  // 这就是multipart处理分块文件的方法
  multipart.parse(req, async (err, fields, files) => {
    if(err) {
      res.end(JSON.stringify({
        code :500,
        message: 'received file failed'
      }))
      throw new Error(err.toString())
    }
    const [chunk] = files.chunk // 获取chunk值，即切片文件
    const [hash] = fields.hash // 这里的hash就是chunk文件的名字，区别分块文件的唯一标示
    const [fileName] = fields.fileName 
    // const dirName = fileName.replace(extractExt(fileName), '') // 这是用来临时存放上传的chunk文件的文件夹名字
    const dirName = hash.split('-')[0] // 这是用来临时存放上传的chunk文件的文件夹名字

    const chunkDir = path.resolve(UPLOAD_DIR, dirName)

    // 正文，如果切片不存在，则创建切片文件夹缓存切片
    if(fse.existsSync(chunkDir)) {
      fse.mkdirsSync(chunkDir) 
    }

    // fs-extra的rename方法windows平台会有权限问题，我想苹果用户应该还好，下面有一些说明
    // https://github.com/meteor/meteor/issues/7852#issuecomment-255767835
    fse.moveSync(chunk.path, `${chunkDir}/${hash}`) // 将上传的文件移动到指定的位置

    res.end(JSON.stringify({
      code :200,
      message: 'received file chunks'
    }))
  })
}

server.listen(3001, () => {
  console.log("server in 3001 start")
})
