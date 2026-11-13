from pathlib import Path
import subprocess,json,yaml,re,concurrent.futures
ROOT=Path(__file__).resolve().parents[1]
SOURCES=json.loads((ROOT/'Rules-Conversion/stash-flclash-sources.json').read_text())
def fetch(item):
 name,url=item
 p=subprocess.run(['curl','-fLsS','--retry','2','--max-time','60',url],capture_output=True,text=True,check=True)
 rules=[]
 for line in p.stdout.splitlines():
  line=line.strip()
  if not line or line.startswith(('#',';','//')):continue
  if ',' not in line:line='DOMAIN-SUFFIX,'+line[1:] if line.startswith('.') else 'DOMAIN,'+line
  rules.append(line)
 assert rules,name
 fl=[re.sub(r',\s+(?=\()',',',l) if l.startswith(('AND,','OR,','NOT,')) else l for l in rules if not any(t in l for t in ['USER-AGENT,','URL-REGEX,'])]
 assert fl,name
 return name,url,rules,fl
results=list(concurrent.futures.ThreadPoolExecutor(max_workers=8).map(fetch,SOURCES.items()))
report={}
for name,url,stash,fl in results:
 for client,rules in [('Stash',stash),('FlClash',fl)]:
  p=ROOT/client/'Rules'/(name+'.yaml');p.parent.mkdir(parents=True,exist_ok=True);p.write_text('# Source: '+url+'\n'+yaml.safe_dump({'payload':rules},sort_keys=False,allow_unicode=True))
 report[name]={'Stash':len(stash),'FlClash':len(fl),'FlClash_unsupported_excluded':len(stash)-len(fl)}
(ROOT/'Rules-Conversion/stash-flclash-resource-counts.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps({'resources':len(results),'clients':2}))
