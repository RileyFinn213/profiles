from pathlib import Path
import yaml,json,urllib.request,concurrent.futures
ROOT=Path(__file__).resolve().parents[1]
SOURCES={
 'Advertising':'https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Surge/Advertising/Advertising.list',
 'Privacy':'https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Surge/Privacy/Privacy.list',
 'Hijacking':'https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Surge/Hijacking/Hijacking.list',
 'Adblock4limbo':'https://raw.githubusercontent.com/limbopro/Adblock4limbo/main/Adblock4limbo_surge.list',
 'rejectAd':'https://raw.githubusercontent.com/fmz200/wool_scripts/main/Loon/rule/rejectAd.list',
 'SystemOTA':'https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Surge/SystemOTA/SystemOTA.list'}
maptypes={'DOMAIN':'domain','DOMAIN-SUFFIX':'domain_suffix','DOMAIN-KEYWORD':'domain_keyword','IP-CIDR':'ip_cidr','IP-CIDR6':'ip_cidr6','IP-ASN':'asn','GEOIP':'geoip','URL-REGEX':'url_regex','USER-AGENT':'user_agent'}
def parse_expr(s):
 s=s.strip()
 if s.startswith('(') and s.endswith(')'):s=s[1:-1]
 typ,rest=s.split(',',1)
 if typ in ['AND','OR','NOT']:
  rest=rest.strip()
  if rest.startswith('(') and rest.endswith(')'):rest=rest[1:-1].strip()
  vals=[];depth=0;start=0
  for i,c in enumerate(rest):
   if c=='(':depth+=1
   elif c==')':depth-=1
   elif c==',' and depth==0:
    vals.append(parse_expr(rest[start:i]));start=i+1
  if rest[start:].strip():vals.append(parse_expr(rest[start:]))
  assert vals,s
  return {typ.lower():{'match':vals if typ!='NOT' else vals[0]}}
 bits=rest.split(',');t=maptypes[typ];v={'match':bits[0].strip('"')}
 if t=='asn':v['match']='AS'+v['match'].removeprefix('AS')
 if 'no-resolve' in bits:v['no_resolve']=True
 return {t:v}

def generate(item):
 name,url=item
 import subprocess
 result=subprocess.run(['curl','-fLsS','--retry','2','--max-time','60',url],capture_output=True,text=True,check=True)
 text=result.stdout;normal={};nr={};count=0
 for num,line in enumerate(text.splitlines(),1):
  line=line.strip()
  if not line or line.startswith(('#',';','//')):continue
  obj=parse_expr(line);typ=next(iter(obj));v=obj[typ]
  dest=nr if v.get('no_resolve') and typ in ['ip_cidr','ip_cidr6','asn','geoip'] else normal
  dest.setdefault(typ+'_set',[]).append(v['match']);count+=1
 assert count>0,name
 outputs={}
 for suffix,data in [('',normal),('-no-resolve',{'no_resolve':True,**nr})]:
  if any(k.endswith('_set') and v for k,v in data.items()):
   outputs['Egern/Rules/'+name+suffix+'.yaml']='# Source: '+url+'\n'+yaml.safe_dump(data,allow_unicode=True,sort_keys=False)
 return name,count,outputs

def main():
 # Fetch/convert everything before mutating generated resources.
 results=list(concurrent.futures.ThreadPoolExecutor(max_workers=6).map(generate,SOURCES.items()))
 outputs={p:s for n,c,items in results for p,s in items.items()}
 for name in ['ChinaASN','ChinaCIDR','ChinaMedia']:
  p=ROOT/'Egern/Rules'/(name+'.yaml');data=yaml.safe_load(p.read_text());data['no_resolve']=True
  outputs['Egern/Rules/'+name+'-parent-no-resolve.yaml']='# Derived from '+name+'.yaml; all IP conditions skip DNS lookup.\n'+yaml.safe_dump(data,allow_unicode=True,sort_keys=False)
 for path,s in outputs.items():
  assert isinstance(yaml.safe_load(s),dict);p=ROOT/path;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(s)
 print(json.dumps({'converted_sources':{n:c for n,c,x in results},'generated_files':list(outputs)},ensure_ascii=False))
if __name__=='__main__':main()
