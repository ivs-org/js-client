import{g as Te,s as be,t as we,q as _e,a as De,b as Se,_ as l,c as dt,k as vt,d as Ce,b6 as q,l as rt,m as Me,Y as Ee,A as Ie,u as Ye}from"./mermaid.core-YmzbFFHC.js";import{c as Ct,g as Mt,t as $e,l as Ae,h as Fe,a as Ut,d as qt,e as Le,j as Oe,k as We,m as Ne,n as Ve,p as Pe,q as ze,s as Zt,u as Qt,v as Kt,w as Jt,x as te}from"./index-C-CU6FLF.js";function Tt(t,e){return t==null||e==null?NaN:t<e?-1:t>e?1:t>=e?0:NaN}function Re(t,e){return t==null||e==null?NaN:e<t?-1:e>t?1:e>=t?0:NaN}function se(t){let e,r,n;t.length!==2?(e=Tt,r=(p,_)=>Tt(t(p),_),n=(p,_)=>t(p)-_):(e=t===Tt||t===Re?t:He,r=t,n=t);function i(p,_,D=0,w=p.length){if(D<w){if(e(_,_)!==0)return w;do{const M=D+w>>>1;r(p[M],_)<0?D=M+1:w=M}while(D<w)}return D}function g(p,_,D=0,w=p.length){if(D<w){if(e(_,_)!==0)return w;do{const M=D+w>>>1;r(p[M],_)<=0?D=M+1:w=M}while(D<w)}return D}function k(p,_,D=0,w=p.length){const M=i(p,_,D,w-1);return M>D&&n(p[M-1],_)>-n(p[M],_)?M-1:M}return{left:i,center:k,right:g}}function He(){return 0}function Be(t){return t===null?NaN:+t}se(Tt);se(Be).center;function Ge(t,e){let r;if(e===void 0)for(const n of t)n!=null&&(r<n||r===void 0&&n>=n)&&(r=n);else{let n=-1;for(let i of t)(i=e(i,++n,t))!=null&&(r<i||r===void 0&&i>=i)&&(r=i)}return r}function je(t,e){let r;if(e===void 0)for(const n of t)n!=null&&(r>n||r===void 0&&n>=n)&&(r=n);else{let n=-1;for(let i of t)(i=e(i,++n,t))!=null&&(r>i||r===void 0&&i>=i)&&(r=i)}return r}function Xe(t){return t}var bt=1,It=2,$t=3,xt=4,ee=1e-6;function Ue(t){return"translate("+t+",0)"}function qe(t){return"translate(0,"+t+")"}function Ze(t){return e=>+t(e)}function Qe(t,e){return e=Math.max(0,t.bandwidth()-e*2)/2,t.round()&&(e=Math.round(e)),r=>+t(r)+e}function Ke(){return!this.__axis}function ae(t,e){var r=[],n=null,i=null,g=6,k=6,p=3,_=typeof window<"u"&&window.devicePixelRatio>1?0:.5,D=t===bt||t===xt?-1:1,w=t===xt||t===It?"x":"y",M=t===bt||t===$t?Ue:qe;function S(C){var R=n??(e.ticks?e.ticks.apply(e,r):e.domain()),V=i??(e.tickFormat?e.tickFormat.apply(e,r):Xe),y=Math.max(g,0)+p,I=e.range(),N=+I[0]+_,W=+I[I.length-1]+_,B=(e.bandwidth?Qe:Ze)(e.copy(),_),H=C.selection?C.selection():C,$=H.selectAll(".domain").data([null]),T=H.selectAll(".tick").data(R,e).order(),h=T.exit(),Y=T.enter().append("g").attr("class","tick"),f=T.select("line"),b=T.select("text");$=$.merge($.enter().insert("path",".tick").attr("class","domain").attr("stroke","currentColor")),T=T.merge(Y),f=f.merge(Y.append("line").attr("stroke","currentColor").attr(w+"2",D*g)),b=b.merge(Y.append("text").attr("fill","currentColor").attr(w,D*y).attr("dy",t===bt?"0em":t===$t?"0.71em":"0.32em")),C!==H&&($=$.transition(C),T=T.transition(C),f=f.transition(C),b=b.transition(C),h=h.transition(C).attr("opacity",ee).attr("transform",function(x){return isFinite(x=B(x))?M(x+_):this.getAttribute("transform")}),Y.attr("opacity",ee).attr("transform",function(x){var v=this.parentNode.__axis;return M((v&&isFinite(v=v(x))?v:B(x))+_)})),h.remove(),$.attr("d",t===xt||t===It?k?"M"+D*k+","+N+"H"+_+"V"+W+"H"+D*k:"M"+_+","+N+"V"+W:k?"M"+N+","+D*k+"V"+_+"H"+W+"V"+D*k:"M"+N+","+_+"H"+W),T.attr("opacity",1).attr("transform",function(x){return M(B(x)+_)}),f.attr(w+"2",D*g),b.attr(w,D*y).text(V),H.filter(Ke).attr("fill","none").attr("font-size",10).attr("font-family","sans-serif").attr("text-anchor",t===It?"start":t===xt?"end":"middle"),H.each(function(){this.__axis=B})}return S.scale=function(C){return arguments.length?(e=C,S):e},S.ticks=function(){return r=Array.from(arguments),S},S.tickArguments=function(C){return arguments.length?(r=C==null?[]:Array.from(C),S):r.slice()},S.tickValues=function(C){return arguments.length?(n=C==null?null:Array.from(C),S):n&&n.slice()},S.tickFormat=function(C){return arguments.length?(i=C,S):i},S.tickSize=function(C){return arguments.length?(g=k=+C,S):g},S.tickSizeInner=function(C){return arguments.length?(g=+C,S):g},S.tickSizeOuter=function(C){return arguments.length?(k=+C,S):k},S.tickPadding=function(C){return arguments.length?(p=+C,S):p},S.offset=function(C){return arguments.length?(_=+C,S):_},S}function Je(t){return ae(bt,t)}function tn(t){return ae($t,t)}var oe={exports:{}};(function(t,e){(function(r,n){t.exports=n()})(Ct,function(){var r="day";return function(n,i,g){var k=function(D){return D.add(4-D.isoWeekday(),r)},p=i.prototype;p.isoWeekYear=function(){return k(this).year()},p.isoWeek=function(D){if(!this.$utils().u(D))return this.add(7*(D-this.isoWeek()),r);var w,M,S,C,R=k(this),V=(w=this.isoWeekYear(),M=this.$u,S=(M?g.utc:g)().year(w).startOf("year"),C=4-S.isoWeekday(),S.isoWeekday()>4&&(C+=7),S.add(C,r));return R.diff(V,"week")+1},p.isoWeekday=function(D){return this.$utils().u(D)?this.day()||7:this.day(this.day()%7?D:D-7)};var _=p.startOf;p.startOf=function(D,w){var M=this.$utils(),S=!!M.u(w)||w;return M.p(D)==="isoweek"?S?this.date(this.date()-(this.isoWeekday()-1)).startOf("day"):this.date(this.date()-1-(this.isoWeekday()-1)+7).endOf("day"):_.bind(this)(D,w)}}})})(oe);var en=oe.exports;const nn=Mt(en);var ce={exports:{}};(function(t,e){(function(r,n){t.exports=n()})(Ct,function(){var r={LTS:"h:mm:ss A",LT:"h:mm A",L:"MM/DD/YYYY",LL:"MMMM D, YYYY",LLL:"MMMM D, YYYY h:mm A",LLLL:"dddd, MMMM D, YYYY h:mm A"},n=/(\[[^[]*\])|([-_:/.,()\s]+)|(A|a|Q|YYYY|YY?|ww?|MM?M?M?|Do|DD?|hh?|HH?|mm?|ss?|S{1,3}|z|ZZ?)/g,i=/\d/,g=/\d\d/,k=/\d\d?/,p=/\d*[^-_:/,()\s\d]+/,_={},D=function(y){return(y=+y)+(y>68?1900:2e3)},w=function(y){return function(I){this[y]=+I}},M=[/[+-]\d\d:?(\d\d)?|Z/,function(y){(this.zone||(this.zone={})).offset=function(I){if(!I||I==="Z")return 0;var N=I.match(/([+-]|\d\d)/g),W=60*N[1]+(+N[2]||0);return W===0?0:N[0]==="+"?-W:W}(y)}],S=function(y){var I=_[y];return I&&(I.indexOf?I:I.s.concat(I.f))},C=function(y,I){var N,W=_.meridiem;if(W){for(var B=1;B<=24;B+=1)if(y.indexOf(W(B,0,I))>-1){N=B>12;break}}else N=y===(I?"pm":"PM");return N},R={A:[p,function(y){this.afternoon=C(y,!1)}],a:[p,function(y){this.afternoon=C(y,!0)}],Q:[i,function(y){this.month=3*(y-1)+1}],S:[i,function(y){this.milliseconds=100*+y}],SS:[g,function(y){this.milliseconds=10*+y}],SSS:[/\d{3}/,function(y){this.milliseconds=+y}],s:[k,w("seconds")],ss:[k,w("seconds")],m:[k,w("minutes")],mm:[k,w("minutes")],H:[k,w("hours")],h:[k,w("hours")],HH:[k,w("hours")],hh:[k,w("hours")],D:[k,w("day")],DD:[g,w("day")],Do:[p,function(y){var I=_.ordinal,N=y.match(/\d+/);if(this.day=N[0],I)for(var W=1;W<=31;W+=1)I(W).replace(/\[|\]/g,"")===y&&(this.day=W)}],w:[k,w("week")],ww:[g,w("week")],M:[k,w("month")],MM:[g,w("month")],MMM:[p,function(y){var I=S("months"),N=(S("monthsShort")||I.map(function(W){return W.slice(0,3)})).indexOf(y)+1;if(N<1)throw new Error;this.month=N%12||N}],MMMM:[p,function(y){var I=S("months").indexOf(y)+1;if(I<1)throw new Error;this.month=I%12||I}],Y:[/[+-]?\d+/,w("year")],YY:[g,function(y){this.year=D(y)}],YYYY:[/\d{4}/,w("year")],Z:M,ZZ:M};function V(y){var I,N;I=y,N=_&&_.formats;for(var W=(y=I.replace(/(\[[^\]]+])|(LTS?|l{1,4}|L{1,4})/g,function(f,b,x){var v=x&&x.toUpperCase();return b||N[x]||r[x]||N[v].replace(/(\[[^\]]+])|(MMMM|MM|DD|dddd)/g,function(a,d,m){return d||m.slice(1)})})).match(n),B=W.length,H=0;H<B;H+=1){var $=W[H],T=R[$],h=T&&T[0],Y=T&&T[1];W[H]=Y?{regex:h,parser:Y}:$.replace(/^\[|\]$/g,"")}return function(f){for(var b={},x=0,v=0;x<B;x+=1){var a=W[x];if(typeof a=="string")v+=a.length;else{var d=a.regex,m=a.parser,u=f.slice(v),E=d.exec(u)[0];m.call(b,E),f=f.replace(E,"")}}return function(s){var A=s.afternoon;if(A!==void 0){var o=s.hours;A?o<12&&(s.hours+=12):o===12&&(s.hours=0),delete s.afternoon}}(b),b}}return function(y,I,N){N.p.customParseFormat=!0,y&&y.parseTwoDigitYear&&(D=y.parseTwoDigitYear);var W=I.prototype,B=W.parse;W.parse=function(H){var $=H.date,T=H.utc,h=H.args;this.$u=T;var Y=h[1];if(typeof Y=="string"){var f=h[2]===!0,b=h[3]===!0,x=f||b,v=h[2];b&&(v=h[2]),_=this.$locale(),!f&&v&&(_=N.Ls[v]),this.$d=function(u,E,s,A){try{if(["x","X"].indexOf(E)>-1)return new Date((E==="X"?1e3:1)*u);var o=V(E)(u),j=o.year,c=o.month,F=o.day,L=o.hours,z=o.minutes,O=o.seconds,G=o.milliseconds,P=o.zone,it=o.week,at=new Date,yt=F||(j||c?1:at.getDate()),lt=j||at.getFullYear(),X=0;j&&!c||(X=c>0?c-1:at.getMonth());var K,Z=L||0,ot=z||0,J=O||0,st=G||0;return P?new Date(Date.UTC(lt,X,yt,Z,ot,J,st+60*P.offset*1e3)):s?new Date(Date.UTC(lt,X,yt,Z,ot,J,st)):(K=new Date(lt,X,yt,Z,ot,J,st),it&&(K=A(K).week(it).toDate()),K)}catch{return new Date("")}}($,Y,T,N),this.init(),v&&v!==!0&&(this.$L=this.locale(v).$L),x&&$!=this.format(Y)&&(this.$d=new Date("")),_={}}else if(Y instanceof Array)for(var a=Y.length,d=1;d<=a;d+=1){h[1]=Y[d-1];var m=N.apply(this,h);if(m.isValid()){this.$d=m.$d,this.$L=m.$L,this.init();break}d===a&&(this.$d=new Date(""))}else B.call(this,H)}}})})(ce);var rn=ce.exports;const sn=Mt(rn);var le={exports:{}};(function(t,e){(function(r,n){t.exports=n()})(Ct,function(){return function(r,n){var i=n.prototype,g=i.format;i.format=function(k){var p=this,_=this.$locale();if(!this.isValid())return g.bind(this)(k);var D=this.$utils(),w=(k||"YYYY-MM-DDTHH:mm:ssZ").replace(/\[([^\]]+)]|Q|wo|ww|w|WW|W|zzz|z|gggg|GGGG|Do|X|x|k{1,2}|S/g,function(M){switch(M){case"Q":return Math.ceil((p.$M+1)/3);case"Do":return _.ordinal(p.$D);case"gggg":return p.weekYear();case"GGGG":return p.isoWeekYear();case"wo":return _.ordinal(p.week(),"W");case"w":case"ww":return D.s(p.week(),M==="w"?1:2,"0");case"W":case"WW":return D.s(p.isoWeek(),M==="W"?1:2,"0");case"k":case"kk":return D.s(String(p.$H===0?24:p.$H),M==="k"?1:2,"0");case"X":return Math.floor(p.$d.getTime()/1e3);case"x":return p.$d.getTime();case"z":return"["+p.offsetName()+"]";case"zzz":return"["+p.offsetName("long")+"]";default:return M}});return g.bind(this)(w)}}})})(le);var an=le.exports;const on=Mt(an);var ue={exports:{}};(function(t,e){(function(r,n){t.exports=n()})(Ct,function(){var r,n,i=1e3,g=6e4,k=36e5,p=864e5,_=31536e6,D=2628e6,w=/^(-|\+)?P(?:([-+]?[0-9,.]*)Y)?(?:([-+]?[0-9,.]*)M)?(?:([-+]?[0-9,.]*)W)?(?:([-+]?[0-9,.]*)D)?(?:T(?:([-+]?[0-9,.]*)H)?(?:([-+]?[0-9,.]*)M)?(?:([-+]?[0-9,.]*)S)?)?$/,M=/\[([^\]]+)]|YYYY|YY|Y|M{1,2}|D{1,2}|H{1,2}|m{1,2}|s{1,2}|SSS/g,S={years:_,months:D,days:p,hours:k,minutes:g,seconds:i,milliseconds:1,weeks:6048e5},C=function($){return $ instanceof B},R=function($,T,h){return new B($,h,T.$l)},V=function($){return n.p($)+"s"},y=function($){return $<0},I=function($){return y($)?Math.ceil($):Math.floor($)},N=function($){return Math.abs($)},W=function($,T){return $?y($)?{negative:!0,format:""+N($)+T}:{negative:!1,format:""+$+T}:{negative:!1,format:""}},B=function(){function $(h,Y,f){var b=this;if(this.$d={},this.$l=f,h===void 0&&(this.$ms=0,this.parseFromMilliseconds()),Y)return R(h*S[V(Y)],this);if(typeof h=="number")return this.$ms=h,this.parseFromMilliseconds(),this;if(typeof h=="object")return Object.keys(h).forEach(function(a){b.$d[V(a)]=h[a]}),this.calMilliseconds(),this;if(typeof h=="string"){var x=h.match(w);if(x){var v=x.slice(2).map(function(a){return a!=null?Number(a):0});return this.$d.years=v[0],this.$d.months=v[1],this.$d.weeks=v[2],this.$d.days=v[3],this.$d.hours=v[4],this.$d.minutes=v[5],this.$d.seconds=v[6],this.calMilliseconds(),this}}return this}var T=$.prototype;return T.calMilliseconds=function(){var h=this;this.$ms=Object.keys(this.$d).reduce(function(Y,f){return Y+(h.$d[f]||0)*S[f]},0)},T.parseFromMilliseconds=function(){var h=this.$ms;this.$d.years=I(h/_),h%=_,this.$d.months=I(h/D),h%=D,this.$d.days=I(h/p),h%=p,this.$d.hours=I(h/k),h%=k,this.$d.minutes=I(h/g),h%=g,this.$d.seconds=I(h/i),h%=i,this.$d.milliseconds=h},T.toISOString=function(){var h=W(this.$d.years,"Y"),Y=W(this.$d.months,"M"),f=+this.$d.days||0;this.$d.weeks&&(f+=7*this.$d.weeks);var b=W(f,"D"),x=W(this.$d.hours,"H"),v=W(this.$d.minutes,"M"),a=this.$d.seconds||0;this.$d.milliseconds&&(a+=this.$d.milliseconds/1e3,a=Math.round(1e3*a)/1e3);var d=W(a,"S"),m=h.negative||Y.negative||b.negative||x.negative||v.negative||d.negative,u=x.format||v.format||d.format?"T":"",E=(m?"-":"")+"P"+h.format+Y.format+b.format+u+x.format+v.format+d.format;return E==="P"||E==="-P"?"P0D":E},T.toJSON=function(){return this.toISOString()},T.format=function(h){var Y=h||"YYYY-MM-DDTHH:mm:ss",f={Y:this.$d.years,YY:n.s(this.$d.years,2,"0"),YYYY:n.s(this.$d.years,4,"0"),M:this.$d.months,MM:n.s(this.$d.months,2,"0"),D:this.$d.days,DD:n.s(this.$d.days,2,"0"),H:this.$d.hours,HH:n.s(this.$d.hours,2,"0"),m:this.$d.minutes,mm:n.s(this.$d.minutes,2,"0"),s:this.$d.seconds,ss:n.s(this.$d.seconds,2,"0"),SSS:n.s(this.$d.milliseconds,3,"0")};return Y.replace(M,function(b,x){return x||String(f[b])})},T.as=function(h){return this.$ms/S[V(h)]},T.get=function(h){var Y=this.$ms,f=V(h);return f==="milliseconds"?Y%=1e3:Y=f==="weeks"?I(Y/S[f]):this.$d[f],Y||0},T.add=function(h,Y,f){var b;return b=Y?h*S[V(Y)]:C(h)?h.$ms:R(h,this).$ms,R(this.$ms+b*(f?-1:1),this)},T.subtract=function(h,Y){return this.add(h,Y,!0)},T.locale=function(h){var Y=this.clone();return Y.$l=h,Y},T.clone=function(){return R(this.$ms,this)},T.humanize=function(h){return r().add(this.$ms,"ms").locale(this.$l).fromNow(!h)},T.valueOf=function(){return this.asMilliseconds()},T.milliseconds=function(){return this.get("milliseconds")},T.asMilliseconds=function(){return this.as("milliseconds")},T.seconds=function(){return this.get("seconds")},T.asSeconds=function(){return this.as("seconds")},T.minutes=function(){return this.get("minutes")},T.asMinutes=function(){return this.as("minutes")},T.hours=function(){return this.get("hours")},T.asHours=function(){return this.as("hours")},T.days=function(){return this.get("days")},T.asDays=function(){return this.as("days")},T.weeks=function(){return this.get("weeks")},T.asWeeks=function(){return this.as("weeks")},T.months=function(){return this.get("months")},T.asMonths=function(){return this.as("months")},T.years=function(){return this.get("years")},T.asYears=function(){return this.as("years")},$}(),H=function($,T,h){return $.add(T.years()*h,"y").add(T.months()*h,"M").add(T.days()*h,"d").add(T.hours()*h,"h").add(T.minutes()*h,"m").add(T.seconds()*h,"s").add(T.milliseconds()*h,"ms")};return function($,T,h){r=h,n=h().$utils(),h.duration=function(b,x){var v=h.locale();return R(b,{$l:v},x)},h.isDuration=C;var Y=T.prototype.add,f=T.prototype.subtract;T.prototype.add=function(b,x){return C(b)?H(this,b,1):Y.bind(this)(b,x)},T.prototype.subtract=function(b,x){return C(b)?H(this,b,-1):f.bind(this)(b,x)}}})})(ue);var cn=ue.exports;const ln=Mt(cn);var At=function(){var t=l(function(v,a,d,m){for(d=d||{},m=v.length;m--;d[v[m]]=a);return d},"o"),e=[6,8,10,12,13,14,15,16,17,18,20,21,22,23,24,25,26,27,28,29,30,31,33,35,36,38,40],r=[1,26],n=[1,27],i=[1,28],g=[1,29],k=[1,30],p=[1,31],_=[1,32],D=[1,33],w=[1,34],M=[1,9],S=[1,10],C=[1,11],R=[1,12],V=[1,13],y=[1,14],I=[1,15],N=[1,16],W=[1,19],B=[1,20],H=[1,21],$=[1,22],T=[1,23],h=[1,25],Y=[1,35],f={trace:l(function(){},"trace"),yy:{},symbols_:{error:2,start:3,gantt:4,document:5,EOF:6,line:7,SPACE:8,statement:9,NL:10,weekday:11,weekday_monday:12,weekday_tuesday:13,weekday_wednesday:14,weekday_thursday:15,weekday_friday:16,weekday_saturday:17,weekday_sunday:18,weekend:19,weekend_friday:20,weekend_saturday:21,dateFormat:22,inclusiveEndDates:23,topAxis:24,axisFormat:25,tickInterval:26,excludes:27,includes:28,todayMarker:29,title:30,acc_title:31,acc_title_value:32,acc_descr:33,acc_descr_value:34,acc_descr_multiline_value:35,section:36,clickStatement:37,taskTxt:38,taskData:39,click:40,callbackname:41,callbackargs:42,href:43,clickStatementDebug:44,$accept:0,$end:1},terminals_:{2:"error",4:"gantt",6:"EOF",8:"SPACE",10:"NL",12:"weekday_monday",13:"weekday_tuesday",14:"weekday_wednesday",15:"weekday_thursday",16:"weekday_friday",17:"weekday_saturday",18:"weekday_sunday",20:"weekend_friday",21:"weekend_saturday",22:"dateFormat",23:"inclusiveEndDates",24:"topAxis",25:"axisFormat",26:"tickInterval",27:"excludes",28:"includes",29:"todayMarker",30:"title",31:"acc_title",32:"acc_title_value",33:"acc_descr",34:"acc_descr_value",35:"acc_descr_multiline_value",36:"section",38:"taskTxt",39:"taskData",40:"click",41:"callbackname",42:"callbackargs",43:"href"},productions_:[0,[3,3],[5,0],[5,2],[7,2],[7,1],[7,1],[7,1],[11,1],[11,1],[11,1],[11,1],[11,1],[11,1],[11,1],[19,1],[19,1],[9,1],[9,1],[9,1],[9,1],[9,1],[9,1],[9,1],[9,1],[9,1],[9,1],[9,1],[9,2],[9,2],[9,1],[9,1],[9,1],[9,2],[37,2],[37,3],[37,3],[37,4],[37,3],[37,4],[37,2],[44,2],[44,3],[44,3],[44,4],[44,3],[44,4],[44,2]],performAction:l(function(a,d,m,u,E,s,A){var o=s.length-1;switch(E){case 1:return s[o-1];case 2:this.$=[];break;case 3:s[o-1].push(s[o]),this.$=s[o-1];break;case 4:case 5:this.$=s[o];break;case 6:case 7:this.$=[];break;case 8:u.setWeekday("monday");break;case 9:u.setWeekday("tuesday");break;case 10:u.setWeekday("wednesday");break;case 11:u.setWeekday("thursday");break;case 12:u.setWeekday("friday");break;case 13:u.setWeekday("saturday");break;case 14:u.setWeekday("sunday");break;case 15:u.setWeekend("friday");break;case 16:u.setWeekend("saturday");break;case 17:u.setDateFormat(s[o].substr(11)),this.$=s[o].substr(11);break;case 18:u.enableInclusiveEndDates(),this.$=s[o].substr(18);break;case 19:u.TopAxis(),this.$=s[o].substr(8);break;case 20:u.setAxisFormat(s[o].substr(11)),this.$=s[o].substr(11);break;case 21:u.setTickInterval(s[o].substr(13)),this.$=s[o].substr(13);break;case 22:u.setExcludes(s[o].substr(9)),this.$=s[o].substr(9);break;case 23:u.setIncludes(s[o].substr(9)),this.$=s[o].substr(9);break;case 24:u.setTodayMarker(s[o].substr(12)),this.$=s[o].substr(12);break;case 27:u.setDiagramTitle(s[o].substr(6)),this.$=s[o].substr(6);break;case 28:this.$=s[o].trim(),u.setAccTitle(this.$);break;case 29:case 30:this.$=s[o].trim(),u.setAccDescription(this.$);break;case 31:u.addSection(s[o].substr(8)),this.$=s[o].substr(8);break;case 33:u.addTask(s[o-1],s[o]),this.$="task";break;case 34:this.$=s[o-1],u.setClickEvent(s[o-1],s[o],null);break;case 35:this.$=s[o-2],u.setClickEvent(s[o-2],s[o-1],s[o]);break;case 36:this.$=s[o-2],u.setClickEvent(s[o-2],s[o-1],null),u.setLink(s[o-2],s[o]);break;case 37:this.$=s[o-3],u.setClickEvent(s[o-3],s[o-2],s[o-1]),u.setLink(s[o-3],s[o]);break;case 38:this.$=s[o-2],u.setClickEvent(s[o-2],s[o],null),u.setLink(s[o-2],s[o-1]);break;case 39:this.$=s[o-3],u.setClickEvent(s[o-3],s[o-1],s[o]),u.setLink(s[o-3],s[o-2]);break;case 40:this.$=s[o-1],u.setLink(s[o-1],s[o]);break;case 41:case 47:this.$=s[o-1]+" "+s[o];break;case 42:case 43:case 45:this.$=s[o-2]+" "+s[o-1]+" "+s[o];break;case 44:case 46:this.$=s[o-3]+" "+s[o-2]+" "+s[o-1]+" "+s[o];break}},"anonymous"),table:[{3:1,4:[1,2]},{1:[3]},t(e,[2,2],{5:3}),{6:[1,4],7:5,8:[1,6],9:7,10:[1,8],11:17,12:r,13:n,14:i,15:g,16:k,17:p,18:_,19:18,20:D,21:w,22:M,23:S,24:C,25:R,26:V,27:y,28:I,29:N,30:W,31:B,33:H,35:$,36:T,37:24,38:h,40:Y},t(e,[2,7],{1:[2,1]}),t(e,[2,3]),{9:36,11:17,12:r,13:n,14:i,15:g,16:k,17:p,18:_,19:18,20:D,21:w,22:M,23:S,24:C,25:R,26:V,27:y,28:I,29:N,30:W,31:B,33:H,35:$,36:T,37:24,38:h,40:Y},t(e,[2,5]),t(e,[2,6]),t(e,[2,17]),t(e,[2,18]),t(e,[2,19]),t(e,[2,20]),t(e,[2,21]),t(e,[2,22]),t(e,[2,23]),t(e,[2,24]),t(e,[2,25]),t(e,[2,26]),t(e,[2,27]),{32:[1,37]},{34:[1,38]},t(e,[2,30]),t(e,[2,31]),t(e,[2,32]),{39:[1,39]},t(e,[2,8]),t(e,[2,9]),t(e,[2,10]),t(e,[2,11]),t(e,[2,12]),t(e,[2,13]),t(e,[2,14]),t(e,[2,15]),t(e,[2,16]),{41:[1,40],43:[1,41]},t(e,[2,4]),t(e,[2,28]),t(e,[2,29]),t(e,[2,33]),t(e,[2,34],{42:[1,42],43:[1,43]}),t(e,[2,40],{41:[1,44]}),t(e,[2,35],{43:[1,45]}),t(e,[2,36]),t(e,[2,38],{42:[1,46]}),t(e,[2,37]),t(e,[2,39])],defaultActions:{},parseError:l(function(a,d){if(d.recoverable)this.trace(a);else{var m=new Error(a);throw m.hash=d,m}},"parseError"),parse:l(function(a){var d=this,m=[0],u=[],E=[null],s=[],A=this.table,o="",j=0,c=0,F=2,L=1,z=s.slice.call(arguments,1),O=Object.create(this.lexer),G={yy:{}};for(var P in this.yy)Object.prototype.hasOwnProperty.call(this.yy,P)&&(G.yy[P]=this.yy[P]);O.setInput(a,G.yy),G.yy.lexer=O,G.yy.parser=this,typeof O.yylloc>"u"&&(O.yylloc={});var it=O.yylloc;s.push(it);var at=O.options&&O.options.ranges;typeof G.yy.parseError=="function"?this.parseError=G.yy.parseError:this.parseError=Object.getPrototypeOf(this).parseError;function yt(Q){m.length=m.length-2*Q,E.length=E.length-Q,s.length=s.length-Q}l(yt,"popStack");function lt(){var Q;return Q=u.pop()||O.lex()||L,typeof Q!="number"&&(Q instanceof Array&&(u=Q,Q=u.pop()),Q=d.symbols_[Q]||Q),Q}l(lt,"lex");for(var X,K,Z,ot,J={},st,tt,Xt,pt;;){if(K=m[m.length-1],this.defaultActions[K]?Z=this.defaultActions[K]:((X===null||typeof X>"u")&&(X=lt()),Z=A[K]&&A[K][X]),typeof Z>"u"||!Z.length||!Z[0]){var Et="";pt=[];for(st in A[K])this.terminals_[st]&&st>F&&pt.push("'"+this.terminals_[st]+"'");O.showPosition?Et="Parse error on line "+(j+1)+`:
`+O.showPosition()+`
Expecting `+pt.join(", ")+", got '"+(this.terminals_[X]||X)+"'":Et="Parse error on line "+(j+1)+": Unexpected "+(X==L?"end of input":"'"+(this.terminals_[X]||X)+"'"),this.parseError(Et,{text:O.match,token:this.terminals_[X]||X,line:O.yylineno,loc:it,expected:pt})}if(Z[0]instanceof Array&&Z.length>1)throw new Error("Parse Error: multiple actions possible at state: "+K+", token: "+X);switch(Z[0]){case 1:m.push(X),E.push(O.yytext),s.push(O.yylloc),m.push(Z[1]),X=null,c=O.yyleng,o=O.yytext,j=O.yylineno,it=O.yylloc;break;case 2:if(tt=this.productions_[Z[1]][1],J.$=E[E.length-tt],J._$={first_line:s[s.length-(tt||1)].first_line,last_line:s[s.length-1].last_line,first_column:s[s.length-(tt||1)].first_column,last_column:s[s.length-1].last_column},at&&(J._$.range=[s[s.length-(tt||1)].range[0],s[s.length-1].range[1]]),ot=this.performAction.apply(J,[o,c,j,G.yy,Z[1],E,s].concat(z)),typeof ot<"u")return ot;tt&&(m=m.slice(0,-1*tt*2),E=E.slice(0,-1*tt),s=s.slice(0,-1*tt)),m.push(this.productions_[Z[1]][0]),E.push(J.$),s.push(J._$),Xt=A[m[m.length-2]][m[m.length-1]],m.push(Xt);break;case 3:return!0}}return!0},"parse")},b=function(){var v={EOF:1,parseError:l(function(d,m){if(this.yy.parser)this.yy.parser.parseError(d,m);else throw new Error(d)},"parseError"),setInput:l(function(a,d){return this.yy=d||this.yy||{},this._input=a,this._more=this._backtrack=this.done=!1,this.yylineno=this.yyleng=0,this.yytext=this.matched=this.match="",this.conditionStack=["INITIAL"],this.yylloc={first_line:1,first_column:0,last_line:1,last_column:0},this.options.ranges&&(this.yylloc.range=[0,0]),this.offset=0,this},"setInput"),input:l(function(){var a=this._input[0];this.yytext+=a,this.yyleng++,this.offset++,this.match+=a,this.matched+=a;var d=a.match(/(?:\r\n?|\n).*/g);return d?(this.yylineno++,this.yylloc.last_line++):this.yylloc.last_column++,this.options.ranges&&this.yylloc.range[1]++,this._input=this._input.slice(1),a},"input"),unput:l(function(a){var d=a.length,m=a.split(/(?:\r\n?|\n)/g);this._input=a+this._input,this.yytext=this.yytext.substr(0,this.yytext.length-d),this.offset-=d;var u=this.match.split(/(?:\r\n?|\n)/g);this.match=this.match.substr(0,this.match.length-1),this.matched=this.matched.substr(0,this.matched.length-1),m.length-1&&(this.yylineno-=m.length-1);var E=this.yylloc.range;return this.yylloc={first_line:this.yylloc.first_line,last_line:this.yylineno+1,first_column:this.yylloc.first_column,last_column:m?(m.length===u.length?this.yylloc.first_column:0)+u[u.length-m.length].length-m[0].length:this.yylloc.first_column-d},this.options.ranges&&(this.yylloc.range=[E[0],E[0]+this.yyleng-d]),this.yyleng=this.yytext.length,this},"unput"),more:l(function(){return this._more=!0,this},"more"),reject:l(function(){if(this.options.backtrack_lexer)this._backtrack=!0;else return this.parseError("Lexical error on line "+(this.yylineno+1)+`. You can only invoke reject() in the lexer when the lexer is of the backtracking persuasion (options.backtrack_lexer = true).
`+this.showPosition(),{text:"",token:null,line:this.yylineno});return this},"reject"),less:l(function(a){this.unput(this.match.slice(a))},"less"),pastInput:l(function(){var a=this.matched.substr(0,this.matched.length-this.match.length);return(a.length>20?"...":"")+a.substr(-20).replace(/\n/g,"")},"pastInput"),upcomingInput:l(function(){var a=this.match;return a.length<20&&(a+=this._input.substr(0,20-a.length)),(a.substr(0,20)+(a.length>20?"...":"")).replace(/\n/g,"")},"upcomingInput"),showPosition:l(function(){var a=this.pastInput(),d=new Array(a.length+1).join("-");return a+this.upcomingInput()+`
`+d+"^"},"showPosition"),test_match:l(function(a,d){var m,u,E;if(this.options.backtrack_lexer&&(E={yylineno:this.yylineno,yylloc:{first_line:this.yylloc.first_line,last_line:this.last_line,first_column:this.yylloc.first_column,last_column:this.yylloc.last_column},yytext:this.yytext,match:this.match,matches:this.matches,matched:this.matched,yyleng:this.yyleng,offset:this.offset,_more:this._more,_input:this._input,yy:this.yy,conditionStack:this.conditionStack.slice(0),done:this.done},this.options.ranges&&(E.yylloc.range=this.yylloc.range.slice(0))),u=a[0].match(/(?:\r\n?|\n).*/g),u&&(this.yylineno+=u.length),this.yylloc={first_line:this.yylloc.last_line,last_line:this.yylineno+1,first_column:this.yylloc.last_column,last_column:u?u[u.length-1].length-u[u.length-1].match(/\r?\n?/)[0].length:this.yylloc.last_column+a[0].length},this.yytext+=a[0],this.match+=a[0],this.matches=a,this.yyleng=this.yytext.length,this.options.ranges&&(this.yylloc.range=[this.offset,this.offset+=this.yyleng]),this._more=!1,this._backtrack=!1,this._input=this._input.slice(a[0].length),this.matched+=a[0],m=this.performAction.call(this,this.yy,this,d,this.conditionStack[this.conditionStack.length-1]),this.done&&this._input&&(this.done=!1),m)return m;if(this._backtrack){for(var s in E)this[s]=E[s];return!1}return!1},"test_match"),next:l(function(){if(this.done)return this.EOF;this._input||(this.done=!0);var a,d,m,u;this._more||(this.yytext="",this.match="");for(var E=this._currentRules(),s=0;s<E.length;s++)if(m=this._input.match(this.rules[E[s]]),m&&(!d||m[0].length>d[0].length)){if(d=m,u=s,this.options.backtrack_lexer){if(a=this.test_match(m,E[s]),a!==!1)return a;if(this._backtrack){d=!1;continue}else return!1}else if(!this.options.flex)break}return d?(a=this.test_match(d,E[u]),a!==!1?a:!1):this._input===""?this.EOF:this.parseError("Lexical error on line "+(this.yylineno+1)+`. Unrecognized text.
`+this.showPosition(),{text:"",token:null,line:this.yylineno})},"next"),lex:l(function(){var d=this.next();return d||this.lex()},"lex"),begin:l(function(d){this.conditionStack.push(d)},"begin"),popState:l(function(){var d=this.conditionStack.length-1;return d>0?this.conditionStack.pop():this.conditionStack[0]},"popState"),_currentRules:l(function(){return this.conditionStack.length&&this.conditionStack[this.conditionStack.length-1]?this.conditions[this.conditionStack[this.conditionStack.length-1]].rules:this.conditions.INITIAL.rules},"_currentRules"),topState:l(function(d){return d=this.conditionStack.length-1-Math.abs(d||0),d>=0?this.conditionStack[d]:"INITIAL"},"topState"),pushState:l(function(d){this.begin(d)},"pushState"),stateStackSize:l(function(){return this.conditionStack.length},"stateStackSize"),options:{"case-insensitive":!0},performAction:l(function(d,m,u,E){switch(u){case 0:return this.begin("open_directive"),"open_directive";case 1:return this.begin("acc_title"),31;case 2:return this.popState(),"acc_title_value";case 3:return this.begin("acc_descr"),33;case 4:return this.popState(),"acc_descr_value";case 5:this.begin("acc_descr_multiline");break;case 6:this.popState();break;case 7:return"acc_descr_multiline_value";case 8:break;case 9:break;case 10:break;case 11:return 10;case 12:break;case 13:break;case 14:this.begin("href");break;case 15:this.popState();break;case 16:return 43;case 17:this.begin("callbackname");break;case 18:this.popState();break;case 19:this.popState(),this.begin("callbackargs");break;case 20:return 41;case 21:this.popState();break;case 22:return 42;case 23:this.begin("click");break;case 24:this.popState();break;case 25:return 40;case 26:return 4;case 27:return 22;case 28:return 23;case 29:return 24;case 30:return 25;case 31:return 26;case 32:return 28;case 33:return 27;case 34:return 29;case 35:return 12;case 36:return 13;case 37:return 14;case 38:return 15;case 39:return 16;case 40:return 17;case 41:return 18;case 42:return 20;case 43:return 21;case 44:return"date";case 45:return 30;case 46:return"accDescription";case 47:return 36;case 48:return 38;case 49:return 39;case 50:return":";case 51:return 6;case 52:return"INVALID"}},"anonymous"),rules:[/^(?:%%\{)/i,/^(?:accTitle\s*:\s*)/i,/^(?:(?!\n||)*[^\n]*)/i,/^(?:accDescr\s*:\s*)/i,/^(?:(?!\n||)*[^\n]*)/i,/^(?:accDescr\s*\{\s*)/i,/^(?:[\}])/i,/^(?:[^\}]*)/i,/^(?:%%(?!\{)*[^\n]*)/i,/^(?:[^\}]%%*[^\n]*)/i,/^(?:%%*[^\n]*[\n]*)/i,/^(?:[\n]+)/i,/^(?:\s+)/i,/^(?:%[^\n]*)/i,/^(?:href[\s]+["])/i,/^(?:["])/i,/^(?:[^"]*)/i,/^(?:call[\s]+)/i,/^(?:\([\s]*\))/i,/^(?:\()/i,/^(?:[^(]*)/i,/^(?:\))/i,/^(?:[^)]*)/i,/^(?:click[\s]+)/i,/^(?:[\s\n])/i,/^(?:[^\s\n]*)/i,/^(?:gantt\b)/i,/^(?:dateFormat\s[^#\n;]+)/i,/^(?:inclusiveEndDates\b)/i,/^(?:topAxis\b)/i,/^(?:axisFormat\s[^#\n;]+)/i,/^(?:tickInterval\s[^#\n;]+)/i,/^(?:includes\s[^#\n;]+)/i,/^(?:excludes\s[^#\n;]+)/i,/^(?:todayMarker\s[^\n;]+)/i,/^(?:weekday\s+monday\b)/i,/^(?:weekday\s+tuesday\b)/i,/^(?:weekday\s+wednesday\b)/i,/^(?:weekday\s+thursday\b)/i,/^(?:weekday\s+friday\b)/i,/^(?:weekday\s+saturday\b)/i,/^(?:weekday\s+sunday\b)/i,/^(?:weekend\s+friday\b)/i,/^(?:weekend\s+saturday\b)/i,/^(?:\d\d\d\d-\d\d-\d\d\b)/i,/^(?:title\s[^\n]+)/i,/^(?:accDescription\s[^#\n;]+)/i,/^(?:section\s[^\n]+)/i,/^(?:[^:\n]+)/i,/^(?::[^#\n;]+)/i,/^(?::)/i,/^(?:$)/i,/^(?:.)/i],conditions:{acc_descr_multiline:{rules:[6,7],inclusive:!1},acc_descr:{rules:[4],inclusive:!1},acc_title:{rules:[2],inclusive:!1},callbackargs:{rules:[21,22],inclusive:!1},callbackname:{rules:[18,19,20],inclusive:!1},href:{rules:[15,16],inclusive:!1},click:{rules:[24,25],inclusive:!1},INITIAL:{rules:[0,1,3,5,8,9,10,11,12,13,14,17,23,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52],inclusive:!0}}};return v}();f.lexer=b;function x(){this.yy={}}return l(x,"Parser"),x.prototype=f,f.Parser=x,new x}();At.parser=At;var un=At;q.extend(nn);q.extend(sn);q.extend(on);var ne={friday:5,saturday:6},et="",Wt="",Nt=void 0,Vt="",ht=[],mt=[],Pt=new Map,zt=[],Dt=[],kt="",Rt="",de=["active","done","crit","milestone","vert"],Ht=[],ut="",gt=!1,Bt=!1,Gt="sunday",St="saturday",Ft=0,dn=l(function(){zt=[],Dt=[],kt="",Ht=[],wt=0,Ot=void 0,_t=void 0,U=[],et="",Wt="",Rt="",Nt=void 0,Vt="",ht=[],mt=[],gt=!1,Bt=!1,Ft=0,Pt=new Map,ut="",Ie(),Gt="sunday",St="saturday"},"clear"),fn=l(function(t){ut=t},"setDiagramId"),hn=l(function(t){Wt=t},"setAxisFormat"),mn=l(function(){return Wt},"getAxisFormat"),kn=l(function(t){Nt=t},"setTickInterval"),yn=l(function(){return Nt},"getTickInterval"),gn=l(function(t){Vt=t},"setTodayMarker"),pn=l(function(){return Vt},"getTodayMarker"),vn=l(function(t){et=t},"setDateFormat"),xn=l(function(){gt=!0},"enableInclusiveEndDates"),Tn=l(function(){return gt},"endDatesAreInclusive"),bn=l(function(){Bt=!0},"enableTopAxis"),wn=l(function(){return Bt},"topAxisEnabled"),_n=l(function(t){Rt=t},"setDisplayMode"),Dn=l(function(){return Rt},"getDisplayMode"),Sn=l(function(){return et},"getDateFormat"),fe=l((t,e)=>{const r=e.toLowerCase().split(/[\s,]+/).filter(n=>n!=="");return[...new Set([...t,...r])]},"mergeTokens"),Cn=l(function(t){ht=fe(ht,t)},"setIncludes"),Mn=l(function(){return ht},"getIncludes"),En=l(function(t){mt=fe(mt,t)},"setExcludes"),In=l(function(){return mt},"getExcludes"),Yn=l(function(){return Pt},"getLinks"),$n=l(function(t){kt=t,zt.push(t)},"addSection"),An=l(function(){return zt},"getSections"),Fn=l(function(){let t=re();const e=10;let r=0;for(;!t&&r<e;)t=re(),r++;return Dt=U,Dt},"getTasks"),he=l(function(t,e,r,n){const i=t.format(e.trim()),g=t.format("YYYY-MM-DD");return n.includes(i)||n.includes(g)?!1:r.includes("weekends")&&(t.isoWeekday()===ne[St]||t.isoWeekday()===ne[St]+1)||r.includes(t.format("dddd").toLowerCase())?!0:r.includes(i)||r.includes(g)},"isInvalidDate"),Ln=l(function(t){Gt=t},"setWeekday"),On=l(function(){return Gt},"getWeekday"),Wn=l(function(t){St=t},"setWeekend"),me=l(function(t,e,r,n){if(!r.length||t.manualEndTime)return;let i;t.startTime instanceof Date?i=q(t.startTime):i=q(t.startTime,e,!0),i=i.add(1,"d");let g;t.endTime instanceof Date?g=q(t.endTime):g=q(t.endTime,e,!0);const[k,p]=Nn(i,g,e,r,n);t.endTime=k.toDate(),t.renderEndTime=p},"checkTaskDates"),Nn=l(function(t,e,r,n,i){let g=!1,k=null;const p=e.add(1e4,"d");for(;t<=e;){if(g||(k=e.toDate()),g=he(t,r,n,i),g&&(e=e.add(1,"d"),e>p))throw new Error("Failed to find a valid date that was not excluded by `excludes` after 10,000 iterations.");t=t.add(1,"d")}return[e,k]},"fixTaskDates"),ke=l(function(t,e){rt.warn(`Gantt: the "${t}" statement references unknown task id(s): ${e.join(", ")}. Make sure the referenced tasks exist and declare an id. Milestones need both an id and a duration, e.g. "Milestone :milestone, m1, 2023-01-01, 0d".`)},"warnAboutUnknownTaskIds"),Lt=l(function(t,e,r){if(r=r.trim(),l(p=>{const _=p.trim();return _==="x"||_==="X"},"isTimestampFormat")(e)&&/^\d+$/.test(r))return new Date(Number(r));const g=/^after\s+(?<ids>[\d\w- ]+)/.exec(r);if(g!==null){let p=null;const _=[],D=g.groups.ids.split(" ").filter(M=>M!=="");for(const M of D){const S=ct(M);if(S===void 0){_.push(M);continue}(!p||S.endTime>p.endTime)&&(p=S)}if(_.length>0&&ke("after",_),p)return p.endTime;const w=new Date;return w.setHours(0,0,0,0),w}let k=q(r,e.trim(),!0);if(k.isValid())return k.toDate();{rt.debug("Invalid date:"+r),rt.debug("With date format:"+e.trim());const p=new Date(r);if(p===void 0||isNaN(p.getTime())||p.getFullYear()<-1e4||p.getFullYear()>1e4)throw new Error("Invalid date:"+r);return p}},"getStartDate"),ye=l(function(t){const e=/^(\d+(?:\.\d+)?)([Mdhmswy]|ms)$/.exec(t.trim());return e!==null?[Number.parseFloat(e[1]),e[2]]:[NaN,"ms"]},"parseDuration"),ge=l(function(t,e,r,n=!1){r=r.trim();const g=/^until\s+(?<ids>[\d\w- ]+)/.exec(r);if(g!==null){let w=null;const M=[],S=g.groups.ids.split(" ").filter(R=>R!=="");for(const R of S){const V=ct(R);if(V===void 0){M.push(R);continue}(!w||V.startTime<w.startTime)&&(w=V)}if(M.length>0&&ke("until",M),w)return w.startTime;const C=new Date;return C.setHours(0,0,0,0),C}let k=q(r,e.trim(),!0);if(k.isValid())return n&&(k=k.add(1,"d")),k.toDate();let p=q(t);const[_,D]=ye(r);if(Number.isNaN(_))rt.warn(`Gantt: "${r}" is neither a valid date for the "${e.trim()}" date format nor a valid duration (e.g. "3d"), so it is ignored and the task gets a zero duration. Milestones need a duration too, e.g. "Milestone :milestone, m1, 2023-01-01, 0d".`);else{const w=p.add(_,D);w.isValid()&&(p=w)}return p.toDate()},"getEndDate"),wt=0,ft=l(function(t){return t===void 0?(wt=wt+1,"task"+wt):t},"parseId"),Vn=l(function(t,e){let r;e.substr(0,1)===":"?r=e.substr(1,e.length):r=e;const n=r.split(","),i={};jt(n,i,de);for(let k=0;k<n.length;k++)n[k]=n[k].trim();let g="";switch(n.length){case 1:i.id=ft(),i.startTime=t.endTime,g=n[0];break;case 2:i.id=ft(),i.startTime=Lt(void 0,et,n[0]),g=n[1];break;case 3:i.id=ft(n[0]),i.startTime=Lt(void 0,et,n[1]),g=n[2];break}return g&&(i.endTime=ge(i.startTime,et,g,gt),i.manualEndTime=q(g,"YYYY-MM-DD",!0).isValid(),me(i,et,mt,ht)),i},"compileData"),Pn=l(function(t,e){let r;e.substr(0,1)===":"?r=e.substr(1,e.length):r=e;const n=r.split(","),i={};jt(n,i,de);for(let g=0;g<n.length;g++)n[g]=n[g].trim();switch(n.length){case 1:i.id=ft(),i.startTime={type:"prevTaskEnd",id:t},i.endTime={data:n[0]};break;case 2:i.id=ft(),i.startTime={type:"getStartDate",startData:n[0]},i.endTime={data:n[1]};break;case 3:i.id=ft(n[0]),i.startTime={type:"getStartDate",startData:n[1]},i.endTime={data:n[2]};break}return i},"parseData"),Ot,_t,U=[],pe={},zn=l(function(t,e){const r={section:kt,type:kt,processed:!1,manualEndTime:!1,renderEndTime:null,raw:{data:e},task:t,classes:[]},n=Pn(_t,e);r.raw.startTime=n.startTime,r.raw.endTime=n.endTime,r.id=n.id,r.prevTaskId=_t,r.active=n.active,r.done=n.done,r.crit=n.crit,r.milestone=n.milestone,r.vert=n.vert,r.vert?r.order=-1:(r.order=Ft,Ft++);const i=U.push(r);_t=r.id,pe[r.id]=i-1},"addTask"),ct=l(function(t){const e=pe[t];return U[e]},"findTaskById"),Rn=l(function(t,e){const r={section:kt,type:kt,description:t,task:t,classes:[]},n=Vn(Ot,e);r.startTime=n.startTime,r.endTime=n.endTime,r.id=n.id,r.active=n.active,r.done=n.done,r.crit=n.crit,r.milestone=n.milestone,r.vert=n.vert,Ot=r,Dt.push(r)},"addTaskOrg"),re=l(function(){const t=l(function(r){const n=U[r];let i="";switch(U[r].raw.startTime.type){case"prevTaskEnd":{const g=ct(n.prevTaskId);n.startTime=g.endTime;break}case"getStartDate":i=Lt(void 0,et,U[r].raw.startTime.startData),i&&(U[r].startTime=i);break}return U[r].startTime&&(U[r].endTime=ge(U[r].startTime,et,U[r].raw.endTime.data,gt),U[r].endTime&&(U[r].processed=!0,U[r].manualEndTime=q(U[r].raw.endTime.data,"YYYY-MM-DD",!0).isValid(),me(U[r],et,mt,ht))),U[r].processed},"compileTask");let e=!0;for(const[r,n]of U.entries())t(r),e=e&&n.processed;return e},"compileTasks"),Hn=l(function(t,e){let r=e;dt().securityLevel!=="loose"&&(r=Ee(e)),t.split(",").forEach(function(n){ct(n)!==void 0&&(xe(n,()=>{window.open(r,"_self")}),Pt.set(n,r))}),ve(t,"clickable")},"setLink"),ve=l(function(t,e){t.split(",").forEach(function(r){let n=ct(r);n!==void 0&&n.classes.push(e)})},"setClass"),Bn=l(function(t,e,r){if(dt().securityLevel!=="loose"||e===void 0)return;let n=[];if(typeof r=="string"){n=r.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);for(let g=0;g<n.length;g++){let k=n[g].trim();k.startsWith('"')&&k.endsWith('"')&&(k=k.substr(1,k.length-2)),n[g]=k}}n.length===0&&n.push(t),ct(t)!==void 0&&xe(t,()=>{Ye.runFunc(e,...n)})},"setClickFun"),xe=l(function(t,e){Ht.push(function(){const r=ut?`${ut}-${t}`:t,n=document.querySelector(`[id="${r}"]`);n!==null&&n.addEventListener("click",function(){e()})},function(){const r=ut?`${ut}-${t}`:t,n=document.querySelector(`[id="${r}-text"]`);n!==null&&n.addEventListener("click",function(){e()})})},"pushFun"),Gn=l(function(t,e,r){t.split(",").forEach(function(n){Bn(n,e,r)}),ve(t,"clickable")},"setClickEvent"),jn=l(function(t){Ht.forEach(function(e){e(t)})},"bindFunctions"),Xn={getConfig:l(()=>dt().gantt,"getConfig"),clear:dn,setDateFormat:vn,getDateFormat:Sn,enableInclusiveEndDates:xn,endDatesAreInclusive:Tn,enableTopAxis:bn,topAxisEnabled:wn,setAxisFormat:hn,getAxisFormat:mn,setTickInterval:kn,getTickInterval:yn,setTodayMarker:gn,getTodayMarker:pn,setAccTitle:Se,getAccTitle:De,setDiagramTitle:_e,getDiagramTitle:we,setDiagramId:fn,setDisplayMode:_n,getDisplayMode:Dn,setAccDescription:be,getAccDescription:Te,addSection:$n,getSections:An,getTasks:Fn,addTask:zn,findTaskById:ct,addTaskOrg:Rn,setIncludes:Cn,getIncludes:Mn,setExcludes:En,getExcludes:In,setClickEvent:Gn,setLink:Hn,getLinks:Yn,bindFunctions:jn,parseDuration:ye,isInvalidDate:he,setWeekday:Ln,getWeekday:On,setWeekend:Wn};function jt(t,e,r){let n=!0;for(;n;)n=!1,r.forEach(function(i){const g="^\\s*"+i+"\\s*$",k=new RegExp(g);t[0].match(k)&&(e[i]=!0,t.shift(1),n=!0)})}l(jt,"getTaskTags");q.extend(ln);var Un=l(function(){rt.debug("Something is calling, setConf, remove the call")},"setConf"),ie={monday:ze,tuesday:Pe,wednesday:Ve,thursday:Ne,friday:We,saturday:Oe,sunday:Le},qn=l((t,e)=>{let r=[...t].map(()=>-1/0),n=[...t].sort((g,k)=>g.startTime-k.startTime||g.order-k.order),i=0;for(const g of n)for(let k=0;k<r.length;k++)if(g.startTime>=r[k]){r[k]=g.endTime,g.order=k+e,k>i&&(i=k);break}return i},"getMaxIntersections"),nt,Yt=1e4,Zn=l(function(t,e,r,n){const i=dt().gantt;n.db.setDiagramId(e);const g=dt().securityLevel;let k;g==="sandbox"&&(k=vt("#i"+e));const p=g==="sandbox"?vt(k.nodes()[0].contentDocument.body):vt("body"),_=g==="sandbox"?k.nodes()[0].contentDocument:document,D=_.getElementById(e);nt=D.parentElement.offsetWidth,nt===void 0&&(nt=1200),i.useWidth!==void 0&&(nt=i.useWidth);const w=n.db.getTasks(),M=w.filter(f=>!f.vert);let S=[];for(const f of M)S.push(f.type);S=Y(S);const C={};let R=2*i.topPadding;if(n.db.getDisplayMode()==="compact"||i.displayMode==="compact"){const f={};for(const x of M)f[x.section]===void 0?f[x.section]=[x]:f[x.section].push(x);let b=0;for(const x of Object.keys(f)){const v=qn(f[x],b)+1;b+=v,R+=v*(i.barHeight+i.barGap),C[x]=v}}else{R+=M.length*(i.barHeight+i.barGap);for(const f of S)C[f]=M.filter(b=>b.type===f).length}D.setAttribute("viewBox","0 0 "+nt+" "+R);const V=p.select(`[id="${e}"]`),y=$e().domain([je(w,function(f){return f.startTime}),Ge(w,function(f){return f.endTime})]).rangeRound([0,nt-i.leftPadding-i.rightPadding]);function I(f,b){const x=f.startTime,v=b.startTime;let a=0;return x>v?a=1:x<v&&(a=-1),a}l(I,"taskCompare"),w.sort(I),N(w,nt,R),Ce(V,R,nt,i.useMaxWidth),V.append("text").text(n.db.getDiagramTitle()).attr("x",nt/2).attr("y",i.titleTopMargin).attr("class","titleText");function N(f,b,x){const v=i.barHeight,a=v+i.barGap,d=i.topPadding,m=i.leftPadding,u=Ae().domain([0,S.length]).range(["#00B9FA","#F95002"]).interpolate(Fe);B(a,d,m,b,x,f,n.db.getExcludes(),n.db.getIncludes()),$(m,d,b,x),W(f,a,d,m,v,u,b),T(a,d),h(m,d,b,x)}l(N,"makeGantt");function W(f,b,x,v,a,d,m){f.sort((c,F)=>c.vert===F.vert?0:c.vert?1:-1);const u=f.filter(c=>!c.vert),s=[...new Set(u.map(c=>c.order))].map(c=>u.find(F=>F.order===c));V.append("g").selectAll("rect").data(s).enter().append("rect").attr("x",0).attr("y",function(c,F){return F=c.order,F*b+x-2}).attr("width",function(){return m-i.rightPadding/2}).attr("height",b).attr("class",function(c){for(const[F,L]of S.entries())if(c.type===L)return"section section"+F%i.numberSectionStyles;return"section section0"}).enter();const A=V.append("g").selectAll("rect").data(f).enter(),o=n.db.getLinks();if(A.append("rect").attr("id",function(c){return e+"-"+c.id}).attr("rx",3).attr("ry",3).attr("x",function(c){return c.milestone?y(c.startTime)+v+.5*(y(c.endTime)-y(c.startTime))-.5*a:y(c.startTime)+v}).attr("y",function(c,F){return F=c.order,c.vert?i.gridLineStartPadding:F*b+x}).attr("width",function(c){return c.milestone?a:c.vert?.08*a:y(c.renderEndTime||c.endTime)-y(c.startTime)}).attr("height",function(c){return c.vert?u.length*(i.barHeight+i.barGap)+i.barHeight*2:a}).attr("transform-origin",function(c,F){return F=c.order,(y(c.startTime)+v+.5*(y(c.endTime)-y(c.startTime))).toString()+"px "+(F*b+x+.5*a).toString()+"px"}).attr("class",function(c){const F="task";let L="";c.classes.length>0&&(L=c.classes.join(" "));let z=0;for(const[G,P]of S.entries())c.type===P&&(z=G%i.numberSectionStyles);let O="";return c.active?c.crit?O+=" activeCrit":O=" active":c.done?c.crit?O=" doneCrit":O=" done":c.crit&&(O+=" crit"),O.length===0&&(O=" task"),c.milestone&&(O=" milestone "+O),c.vert&&(O=" vert "+O),O+=z,O+=" "+L,F+O}),A.append("text").attr("id",function(c){return e+"-"+c.id+"-text"}).text(function(c){return c.task}).attr("font-size",i.fontSize).attr("x",function(c){let F=y(c.startTime),L=y(c.renderEndTime||c.endTime);if(c.milestone&&(F+=.5*(y(c.endTime)-y(c.startTime))-.5*a,L=F+a),c.vert)return y(c.startTime)+v;const z=this.getBBox().width;return z>L-F?L+z+1.5*i.leftPadding>m?F+v-5:L+v+5:(L-F)/2+F+v}).attr("y",function(c,F){return c.vert?i.gridLineStartPadding+u.length*(i.barHeight+i.barGap)+60:(F=c.order,F*b+i.barHeight/2+(i.fontSize/2-2)+x)}).attr("text-height",a).attr("class",function(c){const F=y(c.startTime);let L=y(c.endTime);c.milestone&&(L=F+a);const z=this.getBBox().width;let O="";c.classes.length>0&&(O=c.classes.join(" "));let G=0;for(const[it,at]of S.entries())c.type===at&&(G=it%i.numberSectionStyles);let P="";return c.active&&(c.crit?P="activeCritText"+G:P="activeText"+G),c.done?c.crit?P=P+" doneCritText"+G:P=P+" doneText"+G:c.crit&&(P=P+" critText"+G),c.milestone&&(P+=" milestoneText"),c.vert&&(P+=" vertText"),z>L-F?L+z+1.5*i.leftPadding>m?O+" taskTextOutsideLeft taskTextOutside"+G+" "+P:O+" taskTextOutsideRight taskTextOutside"+G+" "+P+" width-"+z:O+" taskText taskText"+G+" "+P+" width-"+z}),dt().securityLevel==="sandbox"){let c;c=vt("#i"+e);const F=c.nodes()[0].contentDocument;A.filter(function(L){return o.has(L.id)}).each(function(L){var z=F.querySelector("#"+CSS.escape(e+"-"+L.id)),O=F.querySelector("#"+CSS.escape(e+"-"+L.id+"-text"));const G=z.parentNode;var P=F.createElement("a");P.setAttribute("xlink:href",o.get(L.id)),P.setAttribute("target","_top"),G.appendChild(P),P.appendChild(z),P.appendChild(O)})}}l(W,"drawRects");function B(f,b,x,v,a,d,m,u){if(m.length===0&&u.length===0)return;let E,s;for(const{startTime:L,endTime:z}of d)(E===void 0||L<E)&&(E=L),(s===void 0||z>s)&&(s=z);if(!E||!s)return;if(q(s).diff(q(E),"year")>5){rt.warn("The difference between the min and max time is more than 5 years. This will cause performance issues. Skipping drawing exclude days.");return}const A=n.db.getDateFormat(),o=[];let j=null,c=q(E);for(;c.valueOf()<=s;)n.db.isInvalidDate(c,A,m,u)?j?j.end=c:j={start:c,end:c}:j&&(o.push(j),j=null),c=c.add(1,"d");V.append("g").selectAll("rect").data(o).enter().append("rect").attr("id",L=>e+"-exclude-"+L.start.format("YYYY-MM-DD")).attr("x",L=>y(L.start.startOf("day"))+x).attr("y",i.gridLineStartPadding).attr("width",L=>y(L.end.endOf("day"))-y(L.start.startOf("day"))).attr("height",a-b-i.gridLineStartPadding).attr("transform-origin",function(L,z){return(y(L.start)+x+.5*(y(L.end)-y(L.start))).toString()+"px "+(z*f+.5*a).toString()+"px"}).attr("class","exclude-range")}l(B,"drawExcludeDays");function H(f,b,x,v){if(x<=0||f>b)return 1/0;const a=b-f,d=q.duration({[v??"day"]:x}).asMilliseconds();return d<=0?1/0:Math.ceil(a/d)}l(H,"getEstimatedTickCount");function $(f,b,x,v){const a=n.db.getDateFormat(),d=n.db.getAxisFormat();let m;d?m=d:a==="D"?m="%d":m=i.axisFormat??"%Y-%m-%d";let u=tn(y).tickSize(-v+b+i.gridLineStartPadding).tickFormat(Ut(m));const s=/^([1-9]\d*)(millisecond|second|minute|hour|day|week|month)$/.exec(n.db.getTickInterval()||i.tickInterval);if(s!==null){const A=parseInt(s[1],10);if(isNaN(A)||A<=0)rt.warn(`Invalid tick interval value: "${s[1]}". Skipping custom tick interval.`);else{const o=s[2],j=n.db.getWeekday()||i.weekday,c=y.domain(),F=c[0],L=c[1],z=H(F,L,A,o);if(z>Yt)rt.warn(`The tick interval "${A}${o}" would generate ${z} ticks, which exceeds the maximum allowed (${Yt}). This may indicate an invalid date or time range. Skipping custom tick interval.`);else switch(o){case"millisecond":u.ticks(te.every(A));break;case"second":u.ticks(Jt.every(A));break;case"minute":u.ticks(Kt.every(A));break;case"hour":u.ticks(Qt.every(A));break;case"day":u.ticks(Zt.every(A));break;case"week":u.ticks(ie[j].every(A));break;case"month":u.ticks(qt.every(A));break}}}if(V.append("g").attr("class","grid").attr("transform","translate("+f+", "+(v-50)+")").call(u).selectAll("text").style("text-anchor","middle").attr("fill","#000").attr("stroke","none").attr("font-size",10).attr("dy","1em"),n.db.topAxisEnabled()||i.topAxis){let A=Je(y).tickSize(-v+b+i.gridLineStartPadding).tickFormat(Ut(m));if(s!==null){const o=parseInt(s[1],10);if(isNaN(o)||o<=0)rt.warn(`Invalid tick interval value: "${s[1]}". Skipping custom tick interval.`);else{const j=s[2],c=n.db.getWeekday()||i.weekday,F=y.domain(),L=F[0],z=F[1];if(H(L,z,o,j)<=Yt)switch(j){case"millisecond":A.ticks(te.every(o));break;case"second":A.ticks(Jt.every(o));break;case"minute":A.ticks(Kt.every(o));break;case"hour":A.ticks(Qt.every(o));break;case"day":A.ticks(Zt.every(o));break;case"week":A.ticks(ie[c].every(o));break;case"month":A.ticks(qt.every(o));break}}}V.append("g").attr("class","grid").attr("transform","translate("+f+", "+b+")").call(A).selectAll("text").style("text-anchor","middle").attr("fill","#000").attr("stroke","none").attr("font-size",10)}}l($,"makeGrid");function T(f,b){let x=0;const v=Object.keys(C).map(a=>[a,C[a]]);V.append("g").selectAll("text").data(v).enter().append(function(a){const d=a[0].split(Me.lineBreakRegex),m=-(d.length-1)/2,u=_.createElementNS("http://www.w3.org/2000/svg","text");u.setAttribute("dy",m+"em");for(const[E,s]of d.entries()){const A=_.createElementNS("http://www.w3.org/2000/svg","tspan");A.setAttribute("alignment-baseline","central"),A.setAttribute("x","10"),E>0&&A.setAttribute("dy","1em"),A.textContent=s,u.appendChild(A)}return u}).attr("x",10).attr("y",function(a,d){if(d>0)for(let m=0;m<d;m++)return x+=v[d-1][1],a[1]*f/2+x*f+b;else return a[1]*f/2+b}).attr("font-size",i.sectionFontSize).attr("class",function(a){for(const[d,m]of S.entries())if(a[0]===m)return"sectionTitle sectionTitle"+d%i.numberSectionStyles;return"sectionTitle"})}l(T,"vertLabels");function h(f,b,x,v){const a=n.db.getTodayMarker();if(a==="off")return;const d=V.append("g").attr("class","today"),m=new Date,u=d.append("line");u.attr("x1",y(m)+f).attr("x2",y(m)+f).attr("y1",i.titleTopMargin).attr("y2",v-i.titleTopMargin).attr("class","today"),a!==""&&u.attr("style",a.replace(/,/g,";"))}l(h,"drawToday");function Y(f){const b={},x=[];for(let v=0,a=f.length;v<a;++v)Object.prototype.hasOwnProperty.call(b,f[v])||(b[f[v]]=!0,x.push(f[v]));return x}l(Y,"checkUnique")},"draw"),Qn={setConf:Un,draw:Zn},Kn=l(t=>`
  .mermaid-main-font {
        font-family: ${t.fontFamily};
  }

  .exclude-range {
    fill: ${t.excludeBkgColor};
  }

  .section {
    stroke: none;
    opacity: 0.2;
  }

  .section0 {
    fill: ${t.sectionBkgColor};
  }

  .section2 {
    fill: ${t.sectionBkgColor2};
  }

  .section1,
  .section3 {
    fill: ${t.altSectionBkgColor};
    opacity: 0.2;
  }

  .sectionTitle0 {
    fill: ${t.titleColor};
  }

  .sectionTitle1 {
    fill: ${t.titleColor};
  }

  .sectionTitle2 {
    fill: ${t.titleColor};
  }

  .sectionTitle3 {
    fill: ${t.titleColor};
  }

  .sectionTitle {
    text-anchor: start;
    font-family: ${t.fontFamily};
  }


  /* Grid and axis */

  .grid .tick {
    stroke: ${t.gridColor};
    opacity: 0.8;
    shape-rendering: crispEdges;
  }

  .grid .tick text {
    font-family: ${t.fontFamily};
    fill: ${t.textColor};
  }

  .grid path {
    stroke-width: 0;
  }


  /* Today line */

  .today {
    fill: none;
    stroke: ${t.todayLineColor};
    stroke-width: 2px;
  }


  /* Task styling */

  /* Default task */

  .task {
    stroke-width: 2;
  }

  .taskText {
    text-anchor: middle;
    font-family: ${t.fontFamily};
  }

  .taskTextOutsideRight {
    fill: ${t.taskTextDarkColor};
    text-anchor: start;
    font-family: ${t.fontFamily};
  }

  .taskTextOutsideLeft {
    fill: ${t.taskTextDarkColor};
    text-anchor: end;
  }


  /* Special case clickable */

  .task.clickable {
    cursor: pointer;
  }

  .taskText.clickable {
    cursor: pointer;
    fill: ${t.taskTextClickableColor} !important;
    font-weight: bold;
  }

  .taskTextOutsideLeft.clickable {
    cursor: pointer;
    fill: ${t.taskTextClickableColor} !important;
    font-weight: bold;
  }

  .taskTextOutsideRight.clickable {
    cursor: pointer;
    fill: ${t.taskTextClickableColor} !important;
    font-weight: bold;
  }


  /* Specific task settings for the sections*/

  .taskText0,
  .taskText1,
  .taskText2,
  .taskText3 {
    fill: ${t.taskTextColor};
  }

  .task0,
  .task1,
  .task2,
  .task3 {
    fill: ${t.taskBkgColor};
    stroke: ${t.taskBorderColor};
  }

  .taskTextOutside0,
  .taskTextOutside2
  {
    fill: ${t.taskTextOutsideColor};
  }

  .taskTextOutside1,
  .taskTextOutside3 {
    fill: ${t.taskTextOutsideColor};
  }


  /* Active task */

  .active0,
  .active1,
  .active2,
  .active3 {
    fill: ${t.activeTaskBkgColor};
    stroke: ${t.activeTaskBorderColor};
  }

  .activeText0,
  .activeText1,
  .activeText2,
  .activeText3 {
    fill: ${t.taskTextDarkColor} !important;
  }


  /* Completed task */

  .done0,
  .done1,
  .done2,
  .done3 {
    stroke: ${t.doneTaskBorderColor};
    fill: ${t.doneTaskBkgColor};
    stroke-width: 2;
  }

  .doneText0,
  .doneText1,
  .doneText2,
  .doneText3 {
    fill: ${t.taskTextDarkColor} !important;
  }

  /* Done task text displayed outside the bar sits against the diagram background,
     not against the done-task bar, so it must use the outside/contrast color. */
  .doneText0.taskTextOutsideLeft,
  .doneText0.taskTextOutsideRight,
  .doneText1.taskTextOutsideLeft,
  .doneText1.taskTextOutsideRight,
  .doneText2.taskTextOutsideLeft,
  .doneText2.taskTextOutsideRight,
  .doneText3.taskTextOutsideLeft,
  .doneText3.taskTextOutsideRight {
    fill: ${t.taskTextOutsideColor} !important;
  }


  /* Tasks on the critical line */

  .crit0,
  .crit1,
  .crit2,
  .crit3 {
    stroke: ${t.critBorderColor};
    fill: ${t.critBkgColor};
    stroke-width: 2;
  }

  .activeCrit0,
  .activeCrit1,
  .activeCrit2,
  .activeCrit3 {
    stroke: ${t.critBorderColor};
    fill: ${t.activeTaskBkgColor};
    stroke-width: 2;
  }

  .doneCrit0,
  .doneCrit1,
  .doneCrit2,
  .doneCrit3 {
    stroke: ${t.critBorderColor};
    fill: ${t.doneTaskBkgColor};
    stroke-width: 2;
    cursor: pointer;
    shape-rendering: crispEdges;
  }

  .milestone {
    transform: rotate(45deg) scale(0.8,0.8);
  }

  .milestoneText {
    font-style: italic;
  }
  .doneCritText0,
  .doneCritText1,
  .doneCritText2,
  .doneCritText3 {
    fill: ${t.taskTextDarkColor} !important;
  }

  /* Done-crit task text outside the bar — same reasoning as doneText above. */
  .doneCritText0.taskTextOutsideLeft,
  .doneCritText0.taskTextOutsideRight,
  .doneCritText1.taskTextOutsideLeft,
  .doneCritText1.taskTextOutsideRight,
  .doneCritText2.taskTextOutsideLeft,
  .doneCritText2.taskTextOutsideRight,
  .doneCritText3.taskTextOutsideLeft,
  .doneCritText3.taskTextOutsideRight {
    fill: ${t.taskTextOutsideColor} !important;
  }

  .vert {
    stroke: ${t.vertLineColor};
  }

  .vertText {
    font-size: 15px;
    text-anchor: middle;
    fill: ${t.vertLineColor} !important;
  }

  .activeCritText0,
  .activeCritText1,
  .activeCritText2,
  .activeCritText3 {
    fill: ${t.taskTextDarkColor} !important;
  }

  .titleText {
    text-anchor: middle;
    font-size: 18px;
    fill: ${t.titleColor||t.textColor};
    font-family: ${t.fontFamily};
  }
`,"getStyles"),Jn=Kn,nr={parser:un,db:Xn,renderer:Qn,styles:Jn};export{nr as diagram};
