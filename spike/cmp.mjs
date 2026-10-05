import fs from 'node:fs'; const [a,b]=process.argv.slice(2).map(f=>fs.readFileSync(`out/webgl/raw_${f}.bin`)); let n=0,s=0,m=0,sq=0;
for(let i=0;i<a.length;i+=4){let d=0;for(let k=0;k<3;k++){const e=Math.abs(a[i+k]-b[i+k]);d=Math.max(d,e);s+=e;sq+=e*e}if(d)n++;m=Math.max(m,d)}
const px=a.length/4; console.log(process.argv[2],'vs',process.argv[3],`px distintos ${(100*n/px).toFixed(2)}% | MAE ${(s/px/3).toFixed(3)} | max ${m} | PSNR ${(10*Math.log10(255*255/(sq/px/3||1e-9))).toFixed(1)} dB`);
