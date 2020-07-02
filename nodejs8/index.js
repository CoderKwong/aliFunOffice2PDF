const OSS = require('ali-oss').Wrapper;
const { execSync } = require('child_process');

const binPath = '/mnt/auto/instdir/program/soffice';
const defaultArgs = ["--headless", "--invisible", "--nodefault", "--view", "--nolockcheck", "--nologo", "--norestore"];

const fs = require('fs');
const request = require('request');
const rp = require("request-promise");

async function download(url, filename){
    const res = await rp.head(url, {
        resolveWithFullResponse: true
    });

    console.log('content-type:', res.headers['content-type']);
    console.log('content-length:', res.headers['content-length']);

    return new Promise((resolve, reject) => {
        request(url).pipe(fs.createWriteStream(filename))
        .on('close', ()=>{
            console.log("File downloaded to " + filename);
            resolve(filename);
        })
        .on('error', reject);
    });
}

module.exports.handler = async (event, context, callback) => {
  const eventObj = JSON.parse(event.toString());
  console.log(eventObj);
  const {url} = eventObj;
  if(!url) {
    console.log('error, url为空');
    return;
  }
  const position = url.lastIndexOf('/');
  const fileName = url.substr(position + 1);
  const filePath = `/tmp/${fileName}`;

  await download(url, `/tmp/${fileName}`);

  // const filePath = '/tmp/example.docx';

  // execSync(`cp -f /tmp/${fileName} ${filePath}`);

  const cmd = `${binPath} ${defaultArgs.join(' ')} --convert-to pdf --outdir /tmp ${filePath}`;

  const logs = execSync(cmd, { cwd: '/tmp' });

//   execSync(`rm ${filePath}`, { cwd: '/tmp'});

  console.log(logs.toString('utf8'));

  // uploadToOss(context, `/tmp/example.pdf`).then((url) => {
  uploadToOss(context, filePath, fileName).then((url) => {
    execSync(`rm ${filePath}`, { cwd: '/tmp'});
    callback(null, url);
  }).catch((e) => {
    callback(e);
  })
};

async function uploadToOss(context, filePath, fileName) {
    let client = new OSS({
        region: `oss-${process.env.OSS_REGION || context.region}`,
        accessKeyId: context.credentials.accessKeyId,
        accessKeySecret: context.credentials.accessKeySecret,
        stsToken: context.credentials.securityToken,
        bucket: process.env.OSS_BUCKET
    });
  
    let result = await client.put(`${fileName}.pdf`, filePath);
    await client.putACL(`${fileName}.pdf`, 'public-read');
  
    return result.url.replace('-internal.aliyuncs.com/', '.aliyuncs.com/');
}