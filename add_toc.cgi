#!/bin/sh
#prijme v parameterech sysno a obsah v OCR/plain textu. Ulozi ho do nastaveneho adresare (toc_tmp_dir). 
#Pouziva se pro obalkyknih.cz, 2015, jaro
echo 'Content-type: text/html'
echo ''

post=$(</dev/stdin)
WWW_id=`echo $post | grep -oP "id=\d{9}" | sed 's/id=//'`
WWW_toc=`echo $post | grep -oP "toc=[^&]*" | sed 's/toc=//'`
#indikator souborneho zaznamu. prida se do filenamu a na jeho zaklade je upozorneni do log pro rucni kontrolu
WWW_root=`echo $post | grep -oP "part_root=[^&]*" | sed 's/part_root=//'` #ver 1.2 oprava
#ver 1.2 identifikator baze
WWW_base=`echo $post | grep -oP "base=[^&]*" | sed 's/base=//'` #ver 1.2 oprava
if [ "$WWW_base" != "" ]; then
   WWW_base='-'$WWW_base'-'
fi
#ver 1.2 end


toc_tmp_dir="/exlibris/aleph/matyas/toc2load"
logfile='add_toc.log'
admin_email='matyas.bajger@osu.cz'
if [ ! -d "$toc_tmp_dir" ]; then	
   echo `date`" - ERROR directory $toc_tmp_dir does not exist!" >>$logfile
   mail -s "add_toc.cgi error -  directory $toc_tmp_dir does not exist!" $admin_email </dev/null
   echo 'error - directory to save the TOC does not exist'
   exit 0
fi
if [ "$WWW_id" == "" ]; then
   echo `date`" - ERROR sysno is missing in cgi parameters! ($post)" >>$logfile
   mail -s "add_toc.cgi error - sysno is missing in cgi parameters" $admin_email </dev/null
   echo 'error - sysno is missing in cgi parameters' $WWW_id
   exit 0
fi
if [ "$WWW_toc" == "" ]; then
   echo `date`" - ERROR: 'toc' is missing in cgi parameters!" >>$logfile
   mail -s "add_toc.cgi error - 'toc' is missing in cgi parameters" $admin_email </dev/null
   echo 'error - toc is missing in cgi parameters'
   exit 0
fi
datum=`date +%Y%m%d` 
file_name="$toc_tmp_dir/TOC$WWW_base$WWW_id$WWW_root.$datum"
#nutno provest uri decode:
#echo "$WWW_toc" | sed 's/[\n\r]//g'  >$file_name
perl -i -MURI::Escape -e 'print uri_unescape($ARGV[0])'  "$WWW_toc" | sed 's/[\n\r]//g' | sed 's/\\r//g' | sed 's/\\n/ /g' | sed 's/\\t/ /g' | sed 's/\\f//g'  >$file_name


#echo "$WWW_id TOC   L "'$$'"a$WWW_toc" |  sed 's/[\n\r]//g'  >$file_name
echo `date`" - new TOC to upload saved to $file_name" >>$logfile
#debug mail -s "add_toc.cgi - new toc to upload saved in file $file_name" $admin_email </dev/null
echo 'O.K.'
