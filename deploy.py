import os,json,urllib.request,hashlib,base64
from pathlib import Path
w=Path('/var/minis/workspace/tmdb-deploy');key=os.environ.get('GITHUB_TOKEN') or os.environ.get('GH_TOKEN');base='https://api.github.com/repos/RileyFinn213/profiles'
def api(p,d=None,method=None):
 r=urllib.request.Request(base+p,headers={'Authorization':'Bearer '+key,'Content-Type':'application/json','Accept':'application/vnd.github+json'},data=None if d is None else json.dumps(d).encode(),method=method)
 return json.load(urllib.request.urlopen(r,timeout=60))
def sha(b):return hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
parent=api('/git/ref/heads/main')['object']['sha'];c=api('/git/commits/'+parent)
files={str(p.relative_to(w)):p for p in w.rglob('*') if p.is_file()}
existing={x['path']:x for x in api('/git/trees/'+c['tree']['sha']+'?recursive=1')['tree']}
items=[]
for name,p in files.items():
 e=existing.get(name)
 if e and e['sha']==sha(p.read_bytes()):continue
 b=api('/git/blobs',{'content':base64.b64encode(p.read_bytes()).decode(),'encoding':'base64'})
 items.append({'path':name,'mode':'100644','type':'blob','sha':b['sha']})
t=api('/git/trees',{'base_tree':c['tree']['sha'],'tree':items})
n=api('/git/commits',{'message':'Add TMDB metadata scraping rules for Surge, Quantumult X and Loon','tree':t['sha'],'parents':[parent]})
if api('/git/ref/heads/main')['object']['sha']!=parent:raise SystemExit('branch moved')
api('/git/refs/heads/main',{'sha':n['sha'],'force':False},'PATCH')
print(n['html_url'],len(items),'files')
