from pathlib import Path
import json,subprocess,concurrent.futures
ROOT=Path(__file__).resolve().parents[1]
sources=json.loads((ROOT/'Rules-Conversion/loon-derived-sources.json').read_text())
def convert(item):
 p=subprocess.run(['curl','-fsSL','--retry','2','--max-time','60',item['source']],capture_output=True,text=True,check=True)
 rules=[]
 for line in p.stdout.splitlines():
  line=line.strip()
  if not line or line.startswith(('#',';','//')):continue
  if ',' not in line:line='DOMAIN-SUFFIX,'+line[1:] if line.startswith('.') else 'DOMAIN,'+line
  if item['no_resolve'] and line.split(',')[0] in ['IP-CIDR','IP-CIDR6','IP-ASN','GEOIP'] and 'no-resolve' not in line.split(','):line+=',no-resolve'
  rules.append(line)
 assert rules,item['filename']
 return item['filename'],'# Source: '+item['source']+'\n# Native Loon; policy supplied at import.\n'+'\n'.join(rules)+'\n'
outputs=list(concurrent.futures.ThreadPoolExecutor(max_workers=6).map(convert,sources))
for filename,text in outputs:(ROOT/'Loon/Rules'/filename).write_text(text)
print(json.dumps({'generated_files':len(outputs)}))
