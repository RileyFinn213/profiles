import json,re,yaml,urllib.request,concurrent.futures
from pathlib import Path
ROOT=Path(__file__).resolve().parent
# CLI lets GitHub Actions use repo root and a public manifest without private config.
import sys
ROOT=Path(sys.argv[1]) if len(sys.argv)>1 else ROOT/'public'
manifest=json.loads((ROOT/'Rules-Conversion/client-sources.json').read_text());issues=[];counts={}
maptype={'DOMAIN':'domain','DOMAIN-SUFFIX':'domain_suffix','DOMAIN-KEYWORD':'domain_keyword','DOMAIN-WILDCARD':'domain_wildcard','GEOIP':'geoip','IP-CIDR':'ip_cidr','IP-CIDR6':'ip_cidr6','IP-ASN':'asn','USER-AGENT':'user_agent','URL-REGEX':'url_regex','DEST-PORT':'dest_port','DST-PORT':'dest_port','PROTOCOL':'protocol','PROCESS-NAME':'process_name','PROCESS-PATH':'process_path'}
def split_top(s):
 a=[];last=0;depth=0;quote=None
 for i,c in enumerate(s):
  if quote:
   if c==quote and (i==0 or s[i-1]!='\\'):quote=None
  elif c in ('\"',"'"):quote=c
  elif c=='(':depth+=1
  elif c==')':depth-=1
  elif c==',' and depth==0:a.append(s[last:i].strip());last=i+1
 a.append(s[last:].strip());return a

def bare(s):
 s=s.strip()
 while s.startswith('(') and s.endswith(')'):
  dep=0;end=False
  for i,c in enumerate(s):
   if c=='(':dep+=1
   if c==')':dep-=1
   if dep==0 and i<len(s)-1:end=True;break
  if end:break
  s=s[1:-1].strip()
 return s

def regex_cond(s):
 a=split_top(bare(s));typ=a[0]
 if typ in ('AND','OR','NOT'):
  children=split_top(bare(a[1]));rs=[regex_cond(x) for x in children]
  if typ=='AND':return ''.join('(?='+x+')' for x in rs)+'.*'
  if typ=='OR':return '(?:'+'|'.join(rs)+')'
  return '(?!'+rs[0]+').*'
 v=a[1];esc=re.escape(v)
 if typ=='DOMAIN':return esc+'$'
 if typ=='DOMAIN-SUFFIX':return '(?:.*\\.)?'+esc+'$'
 if typ=='DOMAIN-KEYWORD':return '.*'+esc+'.*'
 raise ValueError('logical child not convertible to domain regex '+typ)

def download(item):
 data=urllib.request.urlopen(item['url'],timeout=60).read().decode('utf-8-sig')
 if '<html' in data[:300].lower():raise ValueError('HTML instead of rules '+item['url'])
 return item,data

def one(item,data):
 stash=[];eg={};egnr={};before=0
 for num,line in enumerate(data.splitlines(),1):
  x=line.split(' //',1)[0].strip()
  if not x or x.startswith(('#',';','//')):continue
  before+=1
  if item.get('domainset'):x='DOMAIN-SUFFIX,'+x[1:] if x.startswith('.') else 'DOMAIN,'+x
  a=split_top(x);typ=a[0]
  if typ in ('AND','OR','NOT'):
   clean=re.sub(r',\s*(extended-matching|pre-matching)(?=[,)\s]|$)','',x)
   stash.append(clean)
   try:
    val='(?i)^'+regex_cond(clean)+'$';eg.setdefault('domain_regex_set',[]).append(val)
   except Exception as e:issues.append({'source':item['name'],'line':num,'client':'Egern','rule':x,'reason':str(e)})
   continue
  if typ not in maptype:issues.append({'source':item['name'],'line':num,'rule':x,'reason':'unsupported type'});continue
  val=a[1].strip('"');opts=[p for p in a[2:] if p=='no-resolve'];stash.append(','.join([typ,val]+opts))
  et=maptype[typ]
  if et in ('process_name','process_path'):issues.append({'source':item['name'],'line':num,'client':'Egern','rule':x,'reason':'process conditions not supported'});continue
  if typ=='IP-ASN':val='AS'+val.removeprefix('AS')
  dest=egnr if 'no-resolve' in opts and typ in ('IP-CIDR','IP-CIDR6','IP-ASN','GEOIP') else eg
  dest.setdefault(et+'_set',[]).append(val)
 for dest in (eg,egnr):
  for k in dest:dest[k]=list(dict.fromkeys(dest[k]))
 stash=list(dict.fromkeys(stash));name=item['name'];header='# Source: '+item['url']+'\n# Converted for target client; source attribution and usage terms remain applicable.\n'
 for client,fn,content in [('Stash',name+'.list',header+'\n'.join(stash)+'\n'),('Egern',name+'.yaml',header+yaml.safe_dump(eg,allow_unicode=True,sort_keys=False)),('Egern',name+'-no-resolve.yaml',header+yaml.safe_dump({'no_resolve':True,**egnr},allow_unicode=True,sort_keys=False))]:
  p=ROOT/client/'Rules'/fn;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(content)
 counts[name]={'source':before,'Stash':len(stash),'Egern':sum(len(v) for v in eg.values())+sum(len(v) for v in egnr.values())}
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
 for item,data in pool.map(download,manifest):one(item,data)
(ROOT/'Rules-Conversion/client-conversion-report.json').write_text(json.dumps({'counts':counts,'differences':issues},ensure_ascii=False,indent=2))
print('converted',len(counts),'sources; differences',len(issues))
