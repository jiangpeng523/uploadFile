const http = require('http');
const path = require('path');
const fse = require('fs-extra');
const multiparty = require('multiparty'); // 使用 multiparty 包处理前端传来的 FormData

const server = http.createServer();
const UPLOAD_DIR = path.resolve(__dirname, "..", "target"); // 大文件存储目录

const extractExt = filename =>
  filename.slice(filename.lastIndexOf("."), filename.length); // 提取后缀名

const resolvePost = req =>
  new Promise(resolve => {
    let chunk = "";
    req.on("data", data => { // 获取请求上传的数据或参数
      console.log('data')
      chunk += data;
    });
    req.on("end", () => {
      resolve(JSON.parse(chunk));
    });
  });

const pipeStream = (path, writeStream) =>
  new Promise(resolve => {
    const readStream = fse.createReadStream(path);
    readStream.on("end", () => {
      fse.unlinkSync(path);
      resolve();
    });
    readStream.pipe(writeStream);
  });

// 合并切片
const mergeFileChunk = async (filePath, fileHash, size = 10240) => {
  // const ext = extractExt(filename); // 截取文件后缀名
  let chunkDir = path.resolve(UPLOAD_DIR, fileHash); // 去到指定的文件夹
  let chunkPaths = await fse.readdir(chunkDir);
  // 根据切片下标进行排序
  // 否则直接读取目录的获得的顺序可能会错乱
  chunkPaths.sort((a, b) => a.split("-")[1] - b.split("-")[1]);
  await Promise.all(
    chunkPaths.map((chunkPath, index) =>
      pipeStream(
        path.resolve(chunkDir, chunkPath),
        // 指定位置指定文件创建可写流
        fse.createWriteStream(filePath, {
          start: index * size,
          end: (index + 1) * size
        })
      )
    )
  );
  fse.rmdirSync(chunkDir); // 合并后删除保存切片的目录
};

// 校验文件是否存在
function verifyFileExist({
  filename,
  fileHash
}) {
  const ext = extractExt(filename); // 截取文件后缀名
  const filePath = path.resolve(UPLOAD_DIR, `${fileHash}${ext}`)
  if (fse.existsSync(filePath)) {
    return true
  } else {
    return false
  }
}

// 返回已经上传的切片名列表
const createUploadCacheList = async fileHash => {
  return fse.existsSync(path.resolve(UPLOAD_DIR, fileHash)) ?
    await fse.readdir(path.resolve(UPLOAD_DIR, fileHash)) : []
}

server.on('request', async (req, res) => {
  console.log('有人访问：', req.url);
  res.setHeader('Access-Control-Allow-Origin', '*'); // 服务端设置允许跨域
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') {
    res.status = 200;
    res.end();
    return
  }

  if (req.url === '/verify') {
    const data = await resolvePost(req);
    const {
      fileHash,
      filename
    } = data
    const isExist = verifyFileExist({
      filename,
      fileHash
    });
    if (isExist) { // 如果文件存在，则不需要再上传，实现秒传
      res.end(
        JSON.stringify({
          code: 200,
          shouldUpload: false
        })
      );
    } else { // 如果文件不存在，则返回存在的文件列表
      const uploadCacheList = await createUploadCacheList(fileHash);
      res.end(
        JSON.stringify({
          code: 200,
          shouldUpload: true,
          uploadCacheList
        })
      );
    }

  }

  if (req.url === "/merge") {
    const data = await resolvePost(req);
    const {
      filename,
      fileHash,
      size
    } = data;
    const ext = extractExt(filename); // 截取文件后缀名
    const filePath = path.resolve(UPLOAD_DIR, `${fileHash}${ext}`);
    await mergeFileChunk(filePath, fileHash, size);
    res.end(
      JSON.stringify({
        code: 200,
        message: "file merged success"
      })
    );
    return
  }

  if (req.url === "/uploadFile") {
    const multipart = new multiparty.Form();
    multipart.parse(req, async (err, fields, files) => {
      if (err) {
        return;
      }
      const [chunk] = files.chunk;
      const [hash] = fields.hash;
      let [fileHash] = fields.fileHash || fields.filename;
      // let [filename] = fields.fileName; // 因为用hash作为文件夹名字和文件名 所以不再需要文件原来的文字
      // const ext = extractExt(filename)
      // filename = filename.replace(ext, '')
      const chunkDir = path.resolve(UPLOAD_DIR, fileHash);


      // // 用来做测试 免得每次手动删除
      // if (fse.existsSync(chunkDir)) {
      //   fse.rmdirSync(chunkDir)
      // }

      // 切片目录不存在，创建切片目录
      if (!fse.existsSync(chunkDir)) {
        await fse.mkdirs(chunkDir);
      }

      // fs-extra 专用方法，类似 fs.rename 并且跨平台
      // fs-extra 的 rename 方法 windows 平台会有权限问题
      // https://github.com/meteor/meteor/issues/7852#issuecomment-255767835
      await fse.move(chunk.path, `${chunkDir}/${hash}`);
      res.end(JSON.stringify({
        code: 200,
        message: "received file chunk"
      }));
    });
  }

});



server.listen(3000, () => {
  console.log("server in 3000 start");
})