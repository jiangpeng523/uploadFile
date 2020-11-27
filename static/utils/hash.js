// /public/hash.js
importScripts("spark-md5.min.js"); // 导入脚本

// 生成文件 hash
onmessage = e => {
  const { fileChunks } = e.data
  // 创建
  const spark = new SparkMD5.ArrayBuffer()
  let percentage = 0
  let count = 0
  const loadNext = index => {
    const reader = new FileReader()
    reader.readAsArrayBuffer(fileChunks[index].file)
    reader.onload = event => { //
      count++
      // 利用 spark-md5 对文件内容进行计算得到 hash 值
      spark.append(event.target.result)
      if (count === fileChunks.length) { // 是否计算完成
        postMessage({
          percentage: 100,
          hash: spark.end()
        })
        self.close() // 关闭 worker
      } else {
        percentage += 100 / fileChunks.length
        self.postMessage({ percentage })
        loadNext(count) // 递归计算下一个切片
      }
    }
  }
  loadNext(0) // 开启第一个切片的 hash 计算
}
