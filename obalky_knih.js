var obalkyKnih=new Object();
//pomocne funkce pro ziskani identifikatoru
//ver 1.3 - pridan dig_obj : link na digitalizovany objekt Kramerius
var identifiers=new Object;
identifiers.getISBNs = function() { //najde ISBN (10+13), ISSN i ISMNa, vraci je v poli
   //correction of regex (part for issn), 2016-02-05 
   //var isbnRegex=new RegExp('(([^\\d](97[8|9][\\- ])?[\\dM][\\d\\- ]{10}[\\- ][\\dxX])|([^\\d](97[8|9])?[\\dM]\\d{8}[\\dXx]))|([^\\d]\\d{4}\\-[\\dxX]{4})[^\\d]','g');
   var isbnRegex=new RegExp('(([^\\d](97[8|9][\\- ])?[\\dM][\\d\\- ]{10}[\\- ][\\dxX])|([^\\d](97[8|9])?[\\dM]\\d{8}[\\dXx]))|([^\\d]\\d{4}\\-[\\dxX]{4})[^\\d\'"]','g');
   var bodyText=(document.body.textContent || document.body.innerText);
   var isbnF=(bodyText.match(isbnRegex));
   if ( isbnF==null) {return [];}
   isbnF=identifiers.removeCancelledIds(isbnF,'!',9,17);
   //get unique values
   isbnF.sort();
   for ( var i=0; i<isbnF.length; i++ ) {
      if ( isbnF[i].match(/^[\d]{4}\-[\dxX]{4}.{1}/) ) { isbnF[i]=isbnF[i].slice(0,-1); } //oprava issn - posledni znak rusil. 29.2/2016
      if ( isbnF[i] === isbnF[i-1] ) isbnF.splice(i--, 1);
      }
   //isbn validity check
   for ( i=0; i<isbnF.length; i++ ) {
      var isbn2check = (isbnF[i].replace(/^\s?M\-?/,'979-0-')).replace(/[^\dxX]/g,'');
      var checkSum=0;
      if ( isbn2check.length == 10 ) { //ISBN-10
	 for ( var j=0; j<10; j++ ) checkSum += (10-j) * parseInt(isbn2check.charAt(j).replace(/[xX]/,10));
         if ( checkSum%11!=0 ) { isbnF.splice(i,1); i--; } }
      else if ( isbn2check.length == 13 ) { //ISBN-13, ISMN (10+13)
	 for ( j=0; j<13; j++ ) checkSum += ( ( j%2==0 ) ? 1 : 3 ) * parseInt(isbn2check.charAt(j));
         if ( checkSum%10!=0) { isbnF.splice(i,1); i--; } }
      else if (  isbn2check.length == 8 ) { //ISSN
	 for ( var j=0; j<8; j++ ) checkSum += (8-j) * parseInt(isbn2check.charAt(j).replace(/[xX]/,10)); 
         if ( checkSum%11!=0 ) { isbnF.splice(i,1); i--; } }
      else { isbnF.splice(i,1); i--; }
      }
//EAN code - zpracovava se obalkama jako isbn
   var eans = (((document.body.textContent || document.body.innerText).match(/EAN\s{0,1}\d{8,14}/g)) || []);
   for ( var i=0; i<eans.length; i++ ) { eans[i] = eans[i].replace(/EAN\s/,'');}
   if ( eans.length>0 ) {isbnF.push(eans);}
//
   return isbnF;
   }
identifiers.getOCLCno = function() {
   var oclcF = (document.body.textContent || document.body.innerText).match(/.\(OCoLC\)\d+/g);
   if ( oclcF==null) return [];
   oclcF=identifiers.removeCancelledIds(oclcF,'!',10,20);
   if (typeof oclcF == 'string') var oclcF=[oclcF]; 
   return oclcF;
   }
identifiers.getCNB = function() {
   var cnbF = (document.body.textContent || document.body.innerText).match(/.cnb\d+/g);
   if (cnbF==null) return [];
   cnbF=identifiers.removeCancelledIds(cnbF,'!',5,13);
   if (typeof cnbF == 'string') var cnbF=[cnbF]; 
   return cnbF;
   }
identifiers.removeCancelledIds = function(IDarray,mark,minLength,maxLength) {
   for (var i=0; i<IDarray.length; i++) {
	if (IDarray[i].substr(0,1)==mark) {IDarray.splice(i,1); i--; }
	else {
	   IDarray[i]=IDarray[i].substr(1);
	   if ( IDarray[i].length<minLength || IDarray[i].length>maxLength ) { IDarray.splice(i,1); i--; }
	   }
	}
   return IDarray;
   }
//hlavni funkce pro komunikaci s api obalkyknih, idealne volana pres body onload atribut: <body onload="obalky_knih_30_ask();">
obalkyKnih.ask = function() { 
   if ( typeof JSON == 'undefined' ) {console.warn('Vas prohlizec nepodporuje objekt JSON, nelze nacist data z obalkyknih.cz!'); return; }
   if (typeof XMLHttpRequest == "undefined") {console.warn('Vas prohlizec nepodporuje objekt XMLHttpRequest, nelze nacist data z obalkyknih.cz!'); return; }
   if ( typeof obalkyKnih.domain == 'undefined') { 
	 console.error('obalky_knih.js error - promenna obalkyKnih.domain neexistuje, ma se nacitat do tail sablony pres <include>obalkyknih-url-js'); return; }
   ///priprava identifikatoru pro volani
   var isbns=identifiers.getISBNs(); var oclcs=identifiers.getOCLCno(); var cnbs=identifiers.getCNB();
   var uri_multi='[{';
   if ( isbns.length+oclcs.length+cnbs.length==0) {return;} 
   for (var i=0; i<isbns.length; i++) {
      uri_multi += ',"isbn":"'+isbns[i]+'"';
      }    
   for (i=0; i<oclcs.length; i++) uri_multi += ',"oclc":"'+oclcs[i]+'"';
   for (i=0; i<cnbs.length; i++) uri_multi += ',"nbn":"'+cnbs[i]+'"';
   uri_multi=uri_multi.replace('[{,','[{'); uri_multi += '}]';
   if ( uri_multi=='[{') return; //nejsou zadne identifikatory k dohledani
   //a samotne volani api
   //nasledne volani pres mod_proxy Apache obcas nevratilo nic nebo vratilo neuplnou odpoved (oseklou na konci, nevalidni json objekt]. Matyas Bajger 15.10,2015:q
   obalkyKnih.url= '/obalky/'+obalkyKnih.domain+'/api/books?multi=' + encodeURIComponent(uri_multi);
   //misto presmerovani Apachem lze pouzit presmerovani pomoci CGI skriptu. Sice mene elegantni, ale dle zkusenosti OU spolehlivejsi.
   //obalkyKnih.url= '/cgi-bin/uncgi/redir.cgi?redd=' + encodeURI('http://'+obalkyKnih.domain+'/api/books?multi=' + encodeURIComponent(uri_multi));
   obalkyKnih.request = new XMLHttpRequest();
   if ( obalkyKnih.request == null ) { console.error('Ve skriptech chybi funkce createXMLHttpRequest().!'); return; }
   //obalkyKnih.request.open('GET',obalkyKnih.url,true);
   obalkyKnih.request.open('GET',obalkyKnih.url,true);
   obalkyKnih.request.send();
   obalkyKnih.request.onreadystatechange=function () {
      if (obalkyKnih.request.readyState==4 && obalkyKnih.request.status==200 ) {
	 obalkyKnih.json = '';
	 if ( obalkyKnih.request.responseText.trim() == "" ) { console.log('Odpoved API obalkyknih.cz je prazdna'); }
	 else if ( obalkyKnih.request.responseText.indexOf('[{')==-1 && obalkyKnih.request.responseText!='[]') console.warn('Odpoved API obalkyknih.cz: "'+obalkyKnih.request.responseText+'"  nevypada jako JSON objekt');
	 else { obalkyKnih.json = JSON.parse(obalkyKnih.request.responseText); }
         if ( obalkyKnih.json.length==0 ) return;
	 var obj=obalkyKnih.json[0];
	 //nahled obalky obj.cover_medium_url (170x240px) lze zmenit za mensi nahled nahradou za: cover_icon_url (54x68px)
	 if ( typeof obj.cover_medium_url!= 'undefined' ) { if (obj.cover_medium_url!='') {
		var backlink = typeof obj.backlink_url!='undefined' ? obj.backlink_url : '';
		obalkyKnih.showCover( obj.cover_medium_url, backlink );
		} }
	 //obsah PDF
	 if ( typeof obj.toc_pdf_url != 'undefined' ) { if (obj.toc_full_text!='') {
		var tocThumbnail = typeof obj.toc_thumbnail_url != 'undefined' ? obj.toc_thumbnail_url : '';
		obalkyKnih.showTOC( obj.toc_pdf_url, tocThumbnail );
		} }
	 //hodnoceni
	 if ( (typeof obj.rating_url + typeof obj.rating_avg5 + typeof obj.rating_avg100 + typeof obj.rating_count).indexOf('undefinded') == -1  ) {
                //1. VARIANTA PRO JEDNODUCHE ZOBRAZENI IMG Z OBALKYKNIH.CZ, BEZ MOZNOSTI PRIDAVANI
		//if ( obj.rating_url!='') { obalkyKnih.showRatingSimple(obj.rating_url, backlink); }
		//2. VARIANTA PRO UPLNE ZOBRAZENI VLASTNIM SKRIPTEM S PRIDAVANIM HODNOCENI
		obalkyKnih.showRating(obj.book_id, parseFloat(obj.rating_avg5), parseInt(obj.rating_avg100), parseInt(obj.rating_count));
		}
	 //komentare
	 obalkyKnih.showReviews(obj.book_id, obj.reviews);  
	 //obsah v OCR
	 if ( typeof obj.toc_full_text != 'undefined' ) { if (obj.toc_full_text!='') {
		//zde lze napr. zavolat cgi, ktere prida naskenovany text obsahu do zaznamu
	   if ( typeof sysno != "undefined" ) { if ( sysno != '' ) {
		//toc2send=encodeURIComponent(obj.toc_full_text);
		toc2send=obj.toc_full_text;
//identifikace souborneho zaznamu
		var partRoot='';
		if ( typeof obj.part_root != 'undefined' ) { if (obj.part_root=='1') { partRoot='ROOT'; }}
	        var sendTOC=new XMLHttpRequest();
                sendTOC.param=encodeURI('id='+sysno+'&toc='+toc2send+'&part_root='+partRoot);
		sendTOC.open("POST", '/cgi-bin/add_toc.cgi', true);
		sendTOC.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
		sendTOC.setRequestHeader("Content-length", sendTOC.param.length );
		sendTOC.setRequestHeader("Connection", "close");
		sendTOC.send(sendTOC.param);
		} }
	   } }
	 }
      }
   }
//funkce pro zobrazeni ziskanych dat z obalkyknih.cz
obalkyKnih.showCover = function(coverImg,backlink) {
   var targetEl=document.getElementById('ob_cover');//tento html element <div id="ob_cover"></div> umistete na stranku, kde ma byt obalka (prip. obalky, bude-li jich vice)
   if ( targetEl==null ) {console.error('Element pro umisteni nahledu obalkyknih.cz neexistuje!');return;}
   var obCover = document.createElement('a');
   obCover.href = backlink;
   obCover.title = 'Zobrazit obálku a další info na stránce obalkyknih.cz';
   obCover.innerHTML='<img src="'+coverImg+'" alt=""><br><img src="/obalky_dir/logo_obalkyknih.png" alt="">';
   targetEl.appendChild(obCover);
   targetEl.style.display='';
   }
obalkyKnih.showTOC = function(pdfURL, thumbnail) {
   var targetEl=document.getElementById('ob_toc');//tento html element <div id="ob_toc"></div> umistete na stranku, kde ma byt nahled a link na obsah (obsahy]
   if ( targetEl==null ) {console.error('Element pro umisteni pdf obsahu z obalkyknih.cz neexistuje!');return;}
   var obTOC = document.createElement('a');
   obTOC.href = pdfURL; 
   var obTOC2 = document.createElement('img');
   obTOC2.src = thumbnail;
   obTOC2.width = '170'; //lze nastavit jinou velikost nebo radek vyloucit a spolehnout se na originalni velikost
   obTOC2.style.margin='2%';
   obTOC2.alt = 'OBSAH'; //text, pokud se obrazek nenacte
   obTOC2.title = 'Klikněte pro zobrazení obsahu';
   obTOC.appendChild(obTOC2);
   targetEl.appendChild(obTOC);
//targetEl.innerHTML='<a href="'+pdfURL+'"><img src="'+thumbnail+'" alt="obbbsah"></a>';
   targetEl.style.display='';
   }
obalkyKnih.showRatingSimple = function(starsURL, backlink) {
   var targetEl=document.getElementById('ob_rating');//tento html element <div id="ob_rating"></div> umistete na stranku, kde ma byt zobrazeno hodnoceni 
   if ( targetEl==null ) {console.error('Element pro umisteni hodnoceni z obalkyknih.cz neexistuje!');return;}
   var obRating = document.createElement('a');
   obRating.href = backlink;
   var obRating2 = document.createTextNode('Hodnocení : ');
   var obRating3 =  document.createElement('img');
   obRating3.src = starsURL;
   obRating3.style.verticalAlign='middle';
   obRating3.title = 'Zobrazit další info na stránce obalkyknih.cz';
   obRating.appendChild(obRating2);
   obRating.appendChild(obRating3);
   targetEl.appendChild(obRating);
   targetEl.style.display='';
   }
obalkyKnih.showRating = function(bookID,ratingAvg5,rating100,ratingCount) { 
   var targetEl=document.getElementById('ob_rating'); 
   if ( targetEl==null ) {console.error('Element pro umisteni hodnoceni z obalkyknih.cz neexistuje!');return;}
   ratingAvg5 = ( ratingAvg5>0 && ratingAvg5<=5 ) ? Math.round(ratingAvg5) : 0;
   targetEl.show = function () {
	while ( this.firstChild ) this.removeChild(this.firstChild); //empty the el.
        for (var i=1; i<=5; i++) {
	   var eval=document.createElement('div');
	   eval.className='ratingStar';
	   //var eval2=document.createElement('img');
	   ( i <= ratingAvg5 ) ? eval.style.backgroundImage='url(/obalky_dir/rating_plus.gif)' : eval.style.backgroundImage='url(/obalky_dir/rating_minus.gif)';
           //eval.appendChild(eval2);
           if ( typeof this.block == 'undefined') {
		eval.setAttribute('title2','Kliknutím ohodnotíte školní známkou: '+String(6-i).replace('1','1 (nejlepší)').replace('5','5 (nejhorší)'));}
	   else { eval.setAttribute('title2','Již jste přidali hodnocení');} 
	   eval.onmouseout=function() { targetEl.show(); }
	   this.appendChild(eval); 
	   }
	this.children[0].onmouseover=function() { targetEl.over(1); }; //cannot be set in cycle, function must be later called with actual value
	this.children[1].onmouseover=function() { targetEl.over(2); };
	this.children[2].onmouseover=function() { targetEl.over(3); };
	this.children[3].onmouseover=function() { targetEl.over(4); };
	this.children[4].onmouseover=function() { targetEl.over(5); };
	this.children[0].onclick=function() { targetEl.set(1); };
	this.children[1].onclick=function() { targetEl.set(2); };
	this.children[2].onclick=function() { targetEl.set(3); };
	this.children[3].onclick=function() { targetEl.set(4); };
	this.children[4].onclick=function() { targetEl.set(5); };
	var evalText=document.createElement('span');
	evalText.style.fontSize='80%'; 
        if ( typeof this.comment == 'undefined') this.comment='';
        if ( rating100>0 && rating100<=100 && ratingCount>0) { 
	   evalText.innerHTML = this.comment + 'Oblíbenost:\xa0'+parseInt(rating100)+'% (počet\xa0hodnocení:\xa0'+ratingCount+')'; }
        else if ( parseInt(ratingCount)==0 ) { 
	   (this.comment=='') ? evalText.innerHTML='Dosud nikdo nehodnotil. Buďte\xa0první!' : evalText.innerHTML=this.comment; }
	this.appendChild(evalText);
        }
   targetEl.over = function (i) {
        for ( var j=0; j<5; j++ ) {
	  if ( (j+1)<=i ) { targetEl.children[j].style.backgroundImage = 'url(/obalky_dir/rating_add_plus.gif)';}
	  else { targetEl.children[j].style.backgroundImage = 'url(/obalky_dir/rating_add_minus.gif)';}
	  }
        }
   targetEl.set = function (i) { 
        var newRating = (i*2).toString(); //api prijima hodnoty 1-10
        var sendRating=new XMLHttpRequest();
        sendRating.url= '/obalky/'+obalkyKnih.domain+'/?add_review=true&book_id='+bookID+'&id='+Date.now();
	sendRating.open("POST", sendRating.url, true);
	sendRating.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
	sendRating.setRequestHeader("Content-length", (newRating.length+13) );
	sendRating.setRequestHeader("Connection", "close");
	sendRating.timeout=15*1000;
	sendRating.ontimeout = function() { targetEl.children[5].innerHTML='Chyba při čtení odpovědi. Prosíme, zkuste přidat hodnocení později.'; }
	sendRating.send('rating_value='+newRating);
	sendRating.onreadystatechange=function () {
	   if (sendRating.readyState==4 && sendRating.status==200 ) {
	     if (sendRating.responseText.trim()=='ok') {
		targetEl.comment='Děkujeme za Vaše hodnocení! '; 
		rating100=Math.round(((rating100*ratingCount)+(i*20))/(ratingCount+1));
		ratingCount++;
		ratingAvg5=Math.round(rating100/20);
		targetEl.over=function() {return false;}
		targetEl.set=function() { targetEl.comment='Tento dokument jste již ohodnotili.'; }	
		targetEl.block=true;
		targetEl.show();
		}
	     else { 
		targetEl.comment='Omlouváme se za chybu při přidávání hodnocení. Prosíme, zkuste to později. ';
		console.error('Chyba pri pokusu o pridani noveho hodnoceni ('+sendRating.url+'): '+sendRating.responseText);
		targetEl.show();
		}
	     }
	   else if (sendRating.readyState==4 && sendRating.status>=400 ) {
		targetEl.comment='Omlouváme se za chybu při přidávání hodnocení. Prosíme, zkuste to později. ';
		console.error('Chyba pri pokusu o pridani noveho hodnoceni ('+sendRating.url+'), http code: '+sendRating.status);}
		targetEl.show();
	   }
        }
   targetEl.show();
   }
obalkyKnih.showReviews = function(bookID, reviews) {
   var targetEl=document.getElementById('ob_reviews');//tento html element <div id="ob_reviews"></div> umistete na stranku, kde maji byt zobrazeny komentare
   if ( targetEl==null ) {console.error('Element pro umisteni komentaru z obalkyknih.cz neexistuje!');return;}
   targetEl.show=function() {
      while (this.firstChild) this.removeChild(this.firstChild);
      for (var i=0; i<reviews.length; i++) {
	 if ( typeof reviews[i].html_text == 'string' ) { if (reviews[i].html_text.trim() != '') {
		reviews[i].library_name = reviews[i].library_name || '';
		var repeating=false; //vylouci se shodne komentare od teze knihovny - potencialni chyba
	        for (var j=0; j<i; j++) {
		   if ( reviews[i].html_text==reviews[j].html_text && ((reviews[i].sigla||'').trim()==(reviews[j].sigla||'').trim() || reviews[i].sigla=='' ) ) { repeating=true; break;}  }
		if (repeating) continue;
		var viewRev=document.createElement('div'); viewRev.className='userReviews';
		viewRev.innerHTML='<img src="/obalky_dir/comment.png" alt="">'+reviews[i].html_text.trim();
	        if ( typeof reviews[i].created!='undefined' && typeof reviews[i].library_name!='undefined' ) {
		   var datum=new Date(reviews[i].created);    
		   var dummy=document.createElement('div'); dummy.innerHTML=reviews[i].library_name;
		   viewRev.setAttribute('title2','Komentář přidán: '+datum.getDate()+'. '+(datum.getMonth()+1)+'. '+datum.getFullYear()+', čtenářem knihovny: '+dummy.innerHTML);}
		this.appendChild(viewRev);
		} }	 
	 }
	 this.style.display='';
	 var addRev=document.createElement('div'); 
	 addRev.style.display='none'; 
         addRev.ta=document.createElement('textarea'); addRev.ta.className="newReview"; 
	 addRev.ta.emptyValue='Zde přidejte svůj komentář...\nVaše ohodnocení bude sdíleno s čtenáři ostatních knihoven pomocí služby obalkyknih.cz.';
	 addRev.ta.value=addRev.ta.emptyValue;
	 addRev.ta.onclick=function() { addRev.ta.value=addRev.ta.value.replace(addRev.ta.emptyValue,''); }
	 addRev.appendChild(addRev.ta);
	 addRev.but=document.createElement('img'); addRev.but.src='/obalky_dir/f-add.gif'; addRev.but.setAttribute('alt','Přidat');
	 addRev.but.style.marginLeft='10em';
         addRev.but.onclick=function() { addRev.style.display='none'; 
					if ( addRev.ta.value!=addRev.ta.emptyValue && addRev.ta.value.trim()!='') targetEl.set(addRev.ta.value); else addRev.but.style.display='';}
	 addRev.butC=document.createElement('img'); addRev.butC.src='/obalky_dir/f-cancel.gif'; addRev.butC.setAttribute('alt','Zrušit');
	 addRev.butC.style.marginLeft='2em';
         addRev.butC.onclick=function() { addRev.style.display='none'; addRev.but0.style.display='';}
	 addRev.appendChild(addRev.butC);addRev.appendChild(addRev.but);
	 this.appendChild(addRev);
	 addRev.but0=document.createElement('img'); addRev.but0.src='/obalky_dir/f-add-review.gif'; addRev.but0.setAttribute('alt','Přidat komentář'); addRev.but0.style.marginLeft='1em';
	 addRev.but0.onclick=function() {addRev.but0.style.display='none'; addRev.style.display='block'; };
	 this.appendChild(addRev.but0);
      }   
   targetEl.set=function(review) {
	review=String(review).replace(/<[^>]{2,10}>/g,'');
	if ( review.trim()=='' ) return;
        var sendReview=new XMLHttpRequest();
        sendReview.url= '/obalky/'+obalkyKnih.domain+'/?add_review=true&book_id='+bookID+'&id='+Date.now();
        sendReview.open("POST", sendReview.url, true);
        sendReview.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
        sendReview.setRequestHeader("Content-length", (review.length+12) );
        sendReview.setRequestHeader("Connection", "close");
        sendReview.timeout=15*1000;
        sendReview.ontimeout = function() { targetEl.showError('Chyba při čtení odpovědi. Prosíme, zkuste přidat hodnocení později.');} 
        sendReview.send('review_text='+review);
        sendReview.onreadystatechange=function () {
           if (sendReview.readyState==4 && sendReview.status==200 ) {
             if (sendReview.responseText.trim()=='ok') {
		var rl=reviews.length;
		reviews[rl]= {};
		reviews[rl].html_text=review;
		reviews[rl].created=new Date();
		reviews[rl].library_name='právě vámi. Děkujeme!';
		targetEl.show();
		}
	     else { targetEl.showError('Omlouváme se za chybu při přidávání komentáře. Prosíme, zkuste to později.');
                console.error('Chyba pri pokusu o pridani noveho komentare ('+sendReview.url+'): '+sendReview.responseText); }
             }
	     else if (sendReview.readyState==4 && sendReview.status>=400 ) {
                targetEl.showError('Omlouváme se za chybu při přidávání komentáře. Prosíme, zkuste to později. ');
                console.error('Chyba pri pokusu o pridani noveho hodnoceni ('+sendReview.url+'), http code: '+sendReview.status);}
           }
	}
   targetEl.showError = function(text) {
	this.removeChild(this.children[this.children.length-1]); 
	var errorEl=document.createElement('span');
	var errorEl2=document.createTextNode(text);
	errorEl.appendChild(errorEl2); this.appendChild(errorEl);
      }
   targetEl.show();
   }


//ver 1.3 funkce pro zobrazeni odkazu na digitalni objekty Kramerius, vc. DNNT
obalkyKnih.showDigObj = function(digObj) {
        var targetEl=document.querySelectorAll('#ob_digobj')[0] ;//tento html element <div id="ob_digobj"></div> umistete na stranku, kde maji byt zobrazeny odkazy na digitalizovane verze
        if ( targetEl==null ) {console.error('Element pro umisteni odkazy na digitalizovane verze z obalkyknih.cz neexistuje!');return;}
        //nekolik parametru k zobrazeni:
        var showDNNT = true ; //true hodnota, pokud zobrazovat DNNT;
        var homeSigla = '' ; //zpravidla domovska knihovna. Ukazuje se jako prvni a vzdy i v pripade autorizovaneho pristupu
        var showNonPublicSiglas = []; //pole obsahujici sigly, pro nez bude zobrazovan i autorizovany pristup
        var linkTextHome = 'Digitalizovan&aacute; verze v na&saron;&iacute; digit&aacute;ln&iacute; knihovn&ecaron;'; //text pro zobrazeni ve vlastni knihovne dle promenne homeSigla
        var linkTextPublic = 'Digitalizovan&aacute; verze' //text pro public verze v jinych knihovnach
        var linkTextNonPublic = 'Digitalizovan&aacute; verze - omezen&yacute p&rcaron;&iacutestup'; //text pro public verze v jinych knihovnach
        var linkTextDnnt = 'Digitalizovan&aacute; verze v knihovn&ecaron; D&ecaron;l nedostupn&yacutech na trhu'; //text pro public verze v jinych knihovnach
        targetEl.show = function (siglaw,publ,url) { // zobrazi link na FT
            //TODO preklad sigly pomoci objektu sigla:{ceske_jmeno,anglicke_jmeno}
            //  var siglas = JSON.parse ( '["siglas":{"ABA001":{"cze":"Národní knihovna ČR","eng":"National Library of the Czech Rep."},"BOA001":{"cze":"Moravská zemská knihovna","eng":"Moravian Library (Brno)"},"OLA001":{"cze":"Vědecká knihovna v Olomouci","eng":"Research Library in Olomouc"},"CBA001":{"cze":"Jihočeská vědecká knihovna","eng":"Research Library of South Bohemia"},"OSA001":{"cze":"Moravskoslezská vědecká knihovna","eng":"Moravian-Silesian Research Library"},"ABA007":{"cze":"Knihovna AV ČR","eng":"Library of the Czech Academy of Sciences"}}]');
            //
            var poskytovatel='';
            switch (siglaw) {
                case "ABA001":  poskytovatel = ' (poskytovatel: '+"N&aacute;rodn&iacute; knihovna &Ccaron;R"+')'; break;
                case "BOA001":  poskytovatel = ' (poskytovatel: '+"Moravsk&aacute; zemsk&aacute; knihovna"+')'; break;
                case "OLA001":  poskytovatel = ' (poskytovatel: '+"V&ecaron;deck&aacute; knihovna v Olomouci"+')'; break;
                case "CBA001":  poskytovatel = ' (poskytovatel: '+"Jiho&ccaron;esk&aacute; v&ecaron;deck&aacute; knihovna"+')'; break;
                case "ABA007":  poskytovatel = ' (poskytovatel: '+"Knihovna AV &Ccaron;R"+')'; break;
                default:  poskytovatel = ' (poskytovatel: '+siglaw+')';
                }
            if ( siglaw==homeSigla ) { var showText=linkTextHome; }
            else if ( siglaw=='DNNT' ) { var showText=linkTextDnnt; }
            else if ( !publ )  { var showText=linkTextNonPublic+poskytovatel; }
            else { var showText=linkTextPublic+poskytovatel; }
            targetEl.innerHTML = targetEl.innerHTML + '<a href="'+url+'" target="_blank">'+showText+'</a><br><br>';// link a text
//koronavirus 20200122
            if ( siglaw=='Moravsk&aacute; zemsk&aacute; knihovna' ) {
               targetEl.innerHTML = targetEl.innerHTML.replace('<br><br>','<br><span style="font-family: Verdana; font-size: 80%;">Po dobu nouzov&eacute;ho stavu je digit&aacute;ln&iacute; knihovna Moravsk&eacute; zemsk&eacute; knihovny zp&rcaron;&iacute;stupn&ecaron;na v pln&eacute;m rozsahu pro studenty V&Scaron; a v&ecaron;deck&eacute; pracovn&iacute;ky.<br>Ignoruje pros&iacute;m upozorn&ecaron;n&iacute;, &zcaron;e dokument nen&iacute; ve&rcaron;ejn&ecaron; p&rcaron;&iacute;stupn&yacute; a zvolte v horn&iacute;m menu vpravo "P&rcaron;ihl&aacute;sit". N&aacute;sledn&ecaron; zvolte tla&ccaron;&iacute;tko "P&rcaron;ihl&aacute;sit knihovn&iacute;m &uacute;&ccaron;tem/EduID", v menu knihoven vyberte Ostravskou univerzitu a p&rcaron;ihlaste se jako do Port&aacute;lu OU.</span><br><br');
               }
            else {
               targetEl.innerHTML = targetEl.innerHTML.replace('<br><br>','<br><span style="font-family: Verdana; font-size: 80%;">Po dobu nouzov&eacute;ho stavu je N&aacute;rodn&iacute; digit&aacute;ln&iacute; knihovna zp&rcaron;&iacute;stupn&ecaron;na v pln&eacute;m rozsahu pro studenty V&Scaron; a v&ecaron;deck&eacute; pracovn&iacute;ky.<br>Ignoruje pros&iacute;m upozorn&ecaron;n&iacute;, &zcaron;e dokument nen&iacute; ve&rcaron;ejn&ecaron; p&rcaron;&iacute;stupn&yacute; a zvolte v horn&iacute;m menu vpravo "P&rcaron;ihl&aacute;sit". N&aacute;sledn&ecaron; zvolte tla&ccaron;&iacute;tko "P&rcaron;ihl&aacute;sit knihovn&iacute;m &uacute;&ccaron;tem/EduID", v menu knihoven vyberte Ostravskou univerzitu a p&rcaron;ihlaste se jako do Port&aacute;lu OU.</span><br><br');
               }
            targetEl.innerHTML = targetEl.innerHTML.replace(/^/,'<img src="https://katalog.osu.cz/exlibris/aleph/u23_1/alephe/www_f_cze/icon/f-tn-link.jpg" alt="" title="Digitalizovan&aacute; verze po dobu nouzov&eacute;ho stavu">');
//koronavirus end
            targetEl.style.display='';
            }
        //homeSigla - domovska knihovna
        if ( homeSigla.trim() && typeof digObj[homeSigla] != 'undefined' ) {
            targetEl.show(homeSigla, digObj[homeSigla].public, digObj[homeSigla].url);
            }
        //ostatni Kramerie mimo DNNT
        Object.keys(digObj).forEach(sigla => {
           if ( sigla!='DNNT' && ( digObj[sigla].public || showNonPublicSiglas.includes(sigla) ) ) {
                targetEl.show(sigla, digObj[sigla].public, digObj[sigla].url);
                }
//koronavirus 20200122
           else if ( sigla=='ABA001' ) {
                var uuid='';
                uuid=digObj[sigla].url.match(/uuid.*$/g);
                if ( uuid ) {
                   var covidurl='https://ndk.cz/view/'+uuid[0];
                   targetEl.show('N&aacute;rodn&iacute; digit&aacute;ln&iacute; knihovna', true, covidurl);
                   }
                }
           else if ( sigla=='BOA001' ) {
                var uuid='';
                uuid=digObj[sigla].url.match(/uuid.*$/g);
                if ( uuid ) {
                   var covidurl='https://dnnt.mzk.cz/view/'+uuid[0];
                   targetEl.show('Moravsk&aacute; zemsk&aacute; knihovna', true, covidurl);
                   }
                }

//koronavirus end
            });


        }
