#!/bin/csh -f
#prochazi soubory s OCR obsahy satzenymi z obalkyknih {skript add_toc.cgi) a importuje je do zaznamu
set bibBase='OSU01' #ver 1.2 jen z teto baze budou importovany soubory
set dirwithTOCs='/exlibris/aleph/matyas/toc2load' #cesta na soubory, co se maji importovat
set mailAddr1="katalogizace@osu.cz" #kam se poslou vysledky - importovane obsahy
set mailAddr2="matyas.bajger@osu.cz" #2. adresa pro totez, ponech prazdne, pokud nechces posilat na 2. adresu
#soubory musi byt pojmenovane: TOC{sysno}.{datum}
#datum neni povinne, ale jmeno soubory musi zacinat TOC a za tim 9mistne cislo oznacujici sysno v Alephu

#ver 1.3 OCR obsahy jsou casto double encodovane utf. Pomoci externiho perl s/replace skriptu se jednotlive znaky anharzuji.
#ver 1.4 Lze vyloucit urcitou jednu logickou bazi v poli BAS, do niz obsahz nebudou pridavany. Jeji jmeno definovano nize v promenne basw2exclude. 20230120
#ver 1.4.1 20240801 plneni promenne set isbnDesc= selhavalo, pokud ve vnoreme grepu byly specialni znaky pro shell jako ?? $$. Opraveno nastavenim< set noglob


set logfile="$alephe_scratch/obalkyknih_toc2load.log"
set datum=`date +%Y%m%d`
set bibBaseL=`echo $bibBase | aleph_tr -l`
set backupfile="$alephe_dev/$bibBaseL/scratch/obalkyknih_toc2load_$datum.backup"
set recordLimit=43500 #max lenth of record/DOC in Aleph. In versions 16.02-22.0.3, it is 45,000 bytes. !!! However, the check is this script does nor counr CAT fields. as they are not exported by print-03. So this limit should be lower than the real. If the lenght limit is still exceeded, import manage-18 warns and this worn is moved to the toc_import log and mailed. If the limit is exceeded by this setting, imported TOC is cut at its end.
set base2exclude='Proquest Academic Complete' #ver 1.4

echo "-----------------------------------------------------------" | tee -a $logfile
echo "start - `date`" | tee -a $logfile
#cyklus na vsechny pripravene soubory s TOC pro import 
if ( ! -e "$dirwithTOCs") then
   echo "ERROR - directory wirth TOC to import $dirwithTOCs does not exist! Bye." | tee -a $logfile
   exit 1
endif
if ( `ls $dirwithTOCs/TOC* -1 | wc -l | bc` == 0 ) then
   echo "Nothing to import - no files "$dirwithTOCs/TOC*" found. Bye." | tee -a $logfile
   exit 0
endif
mkdir -p "$dirwithTOCs/save-$datum"
cp /dev/null $alephe_dev/$bibBaseL/scratch/toc2import
cp /dev/null $alephe_dev/$bibBaseL/scratch/toc2import.warn
foreach file ($dirwithTOCs/TOC*)
   if (-d "$file") then
      echo "Skipping $file (is a directory)" | tee -a $logfile
      continue
   endif
   echo "Processing file $file (`date`)" | tee -a $logfile
#ver 1.2 - vylouci se obsahy z jine baze
   if ( `basename "$file" | awk '{print substr($0,5,5);}' | grep -c '[a-zA-Z]\{3\}[0-9]\{2\}' | bc` == 1 && `basename "$file" | awk '{print substr($0,5,5);}' | aleph_tr -l` != "$bibBaseL" ) then
      echo "Note - TOC in file $file does not belong to $bibBase base. skipping..." | tee -a $logfile
      mv $file "$dirwithTOCs/save-$datum/"
      continue
   endif
#ver 1.2 end
   set sysno=`echo "$file" | grep -oP '\d{9}'`
   if ( `grep -c "^$sysno" $alephe_dev/$bibBaseL/scratch/toc2import | bc` != 0 ) then
      echo "Note - TOC for sysno $sysno has been already prepared to import." | tee -a $logfile
      mv $file "$dirwithTOCs/save-$datum/"
      continue
   endif
   #kontrola, jestli uz soubor nema pole TOC, export pro backup
   echo "     exporting the related record using p_print_03 ..." | tee -a $logfile
   rm -f $alephe_scratch/obalky_toc.tmp
   echo $sysno$bibBase >$alephe_scratch/obalky_toc.tmp
   #export print 03
   #!!ve vyexportovanem zaznamu musi byt expandovane pole jednotek Z30 - pouziva se dale pro kontrolu, zda nejde o vicedilnou nebo pokracujici publikaci
   #print03 tak musi byt spusten s expanzi obsahujici expanzni program expand_doc_bib_z30
   #Zde je pouzit specialni pro tento ucel dedikovany typ expanze Z30 v nastaveni tab_expand :
   #Z30        expand_doc_bib_z30
   csh -f $aleph_proc/p_print_03 "$bibBase,obalky_toc.tmp,ALL,,,,,,,,obalky_toc_exp.tmp,A,,Z30,,N," >/dev/null
   if (! -e $alephe_dev/$bibBaseL/scratch/obalky_toc_exp.tmp ) then
      echo "ERROR - export p_print_03 for sysno $sysno failed!. Skipping (not importing) this sysno/TOC." | tee -a $logfile
      mv $file "$dirwithTOCs/save-$datum/"
      continue
   endif
   if ( -z $alephe_dev/$bibBaseL/scratch/obalky_toc_exp.tmp ) then
      echo "WARNING - sysno $sysno does not exist in the $bibBase base, skipping."  | tee -a $logfile
      mv $file "$dirwithTOCs/save-$datum/"
      continue
   endif
   if ( `grep "^$sysno DEL" $alephe_dev/$bibBaseL/scratch/obalky_toc_exp.tmp -c | bc` != 0 ) then
      echo "WARNING - record with sysno $sysno has been already deleted! Skipping." | tee -a $logfile
      mv $file "$dirwithTOCs/save-$datum/"
      continue
   endif 
   
   #TODO 20220516 pridano vylouceni pro zaznamy z rychle katalogizace, zpracovavaji takto fond Jacques Rupnik.
   #      pokud to jednou pomine, lze nasl. podminku odstranit.   Matyas B.
   if ( `grep "^$sysno UPL.*Rupnik" $alephe_dev/$bibBaseL/scratch/obalky_toc_exp.tmp -i -c | bc` != 0 ) then
      echo "NOTE - record with sysno $sysno belongs to J. Rupnik collection fast cataloguing. Skipping." | tee -a $logfile
      mv $file "$dirwithTOCs/save-$datum/"
      continue
   endif 
   #
   
   #ver 1.4
   if ( `grep "^$sysno BAS.*$base2exclude" $alephe_dev/$bibBaseL/scratch/obalky_toc_exp.tmp -i -c | bc` != 0 ) then
      echo "NOTE - record with sysno $sysno belongs to base '$base2exclude' that was set to be excluded from TOC import. Skipping." | tee -a $logfile
      mv $file "$dirwithTOCs/save-$datum/"
      continue
   endif
   #ver 1.4 end
   
   if ( `grep "^$sysno TOC" $alephe_dev/$bibBaseL/scratch/obalky_toc_exp.tmp -c | bc` != 0 ) then
      echo "Record $sysno ($bibBase) has already a TOC field, skipping." | tee -a $logfile


      #kontrola jestli jednotky nejsou ruzne u videdilnych nebo pokracujicich dokumentu, Identifikujici se pomoci pole Z30-2 (2.ind. = 2 )
      if ( `grep "^$sysno Z30-2" $alephe_dev/$bibBaseL/scratch/obalky_toc_exp.tmp -c | bc` >1 ) then
         #20210204 pridana jeste podminka, ze ople TOC uz neni vynulovane
         if ( `grep '^$sysno TOC   L \$\$a\s*$' $alephe_dev/$bibBaseL/scratch/obalky_toc_exp.tmp -c | bc` >0 ) then
            echo "WARNING - record with sysno $sysno has items that look not identical (more volumes, periodic etc.) - it's worthy of a check" | tee -a $logfile
            printf "\n\nWARNING - record with sysno $sysno has aleady a TOC field, but its items look as not identical (more volumes, periodic etc.) - it's worthy of a check\n\n" >>$alephe_dev/$bibBaseL/scratch/toc2import.warn
         endif
      endif
      #kontrola na isbn v poli 902 - jde o vicesvazkovy zaznam, doplneno 20150612
      if ( `grep "^$sysno 902" $alephe_dev/$bibBaseL/scratch/obalky_toc_exp.tmp -c | bc` >0 ) then
         #20210204 pridana jeste podminka, ze ople TOC uz neni vynulovane
         if ( `grep '^$sysno TOC   L \$\$a\s*$' $alephe_dev/$bibBaseL/scratch/obalky_toc_exp.tmp -c | bc` >0 ) then
            echo "WARNING - record with sysno $sysno has already a TOC field, but has ISBN in field 902, looks like multi-vol record - it's worthy of a check" | tee -a $logfile
            echo "WARNING - record with sysno $sysno has already a TOC field, has ISBN in field 902, looks like multi-vol record - it's worthy of a check" >>$alephe_dev/$bibBaseL/scratch/toc2import.warn
         endif
      endif
      mv $file "$dirwithTOCs/save-$datum/"
      continue
   endif
#uprava souboru pro import a import
   echo "adding TOC to sysno $sysno (file $file) to the file for later import" | tee -a $logfile
   cat $alephe_dev/$bibBaseL/scratch/obalky_toc_exp.tmp >>$backupfile
   #create temporary awk file and rearrange and check the TOC
   awk 'NR==1{sub(/^\xef\xbb\xbf/,"")}1' $file >$file.tmp
#20240321 vylouceni pomocneho znaku (pocatek oddilu??] na zacatku obsahu
   sed -i 's/ď»ż//' $file.tmp

   mv $file.tmp $file
   echo 'BEGIN {FS=""; x=1; repeated=""; nl=""; lineno=1;}\
{\
for (i=1;i<=NF;i++) {\
   if ( x>1500 && $i==" " ) {\
      print "TOC   L "repeated"$$a"nl;\
      x=1;\
      lineno++;\
      repeated="$$9"sprintf("%02d", lineno);\
      nl="";\
      }\
   else {\
      nl=nl $i;\
      x++;\
      }\
   }\
}\
END { print "TOC   L "repeated"$$a"nl; }' >$alephe_dev/$bibBaseL/scratch/obalkyknih_toc2load.awk.tmp
#nasledne: 1. odstrani opakujici se znaky (tecky, mezery), 2. rozdeli text na pole s 1500 znaky (nedeoli slova, 3. prida sysno,  4. odstrani Byte-order mark na zacatku 
   #ver 1.3 prideano dirwithTOCs/repair_double_encoding
   sed 's/\([[:punct:]]\)\1\{3,\}/\1\1\1/g' $file | sed 's/\([[:blank:]]\)\1\+/\1/g' | perl -p -e 's/\n/ \/\/ /' | sed 's/\- \/\/ //g' | $dirwithTOCs/repair_double_encoding | awk -f $alephe_dev/$bibBaseL/scratch/obalkyknih_toc2load.awk.tmp | sed "s/^/$sysno /" | sed 's/\/\/ *$//g' >$alephe_dev/$bibBaseL/scratch/toc2import.tmp
   if (! -e $alephe_dev/$bibBaseL/scratch/toc2import.tmp ) then
      echo "ERROR while importing file $file (sysno $sysno) - check and reaarange to aleph seq format failed. Skipping this sysno."
      mv $file "$dirwithTOCs/save-$datum/"
      continue
   endif
   #kontrola na velikost zaznamu, zaznam v aleph (ver 16.02 - 22.01) nemuze byt delsi nez 4500 znaku bez kodu poli 	
   @ recLength=`awk '{print substr($0,19);}' $alephe_dev/$bibBaseL/scratch/obalky_toc_exp.tmp | wc -c | bc`
   #RC 20210315 @ tocLength=`cat $alephe_dev/$bibBaseL/scratch/obalky_toc_exp.tmp | wc -c | bc`
   @ tocLength=`cat $alephe_dev/$bibBaseL/scratch/toc2import.tmp | wc -c | bc`


#RC 20210315 - whole check of record length has been replace (the followinf if)
   if ( $recLength + $tocLength > $recordLimit ) then
      echo "WARNING - The record $sysno would be longer after the import than allows the limit of the record/doc length - $recordLimit bytes" | tee -a $logfile
      echo "WARNING - The record $sysno would be longer after the import than allows the limit of the record/doc length - $recordLimit bytes"  >>$alephe_dev/$bibBaseL/scratch/toc2import.warn
      @ maxTOClength=($recordLimit - $recLength)
      @ trimmedTOClength=($recordLimit - $tocLength)
      while ( `cat  $alephe_dev/$bibBaseL/scratch/toc2import.tmp | wc -c | bc` > $maxTOClength ) 
         sed '$ s/ [^ ]*\s*$//'  $alephe_dev/$bibBaseL/scratch/toc2import.tmp > $alephe_dev/$bibBaseL/scratch/toc2import.tmp.trim
         #the whole field has been ommited, only doc_number and field_code remains. Remove the field - the last line
         if ( `tail -n1 $alephe_dev/$bibBaseL/scratch/toc2import.tmp.trim | wc -c | bc` < 20 ) then
            head -n -1 $alephe_dev/$bibBaseL/scratch/toc2import.tmp.trim >$alephe_dev/$bibBaseL/scratch/toc2import.tmp
         else
            mv $alephe_dev/$bibBaseL/scratch/toc2import.tmp.trim $alephe_dev/$bibBaseL/scratch/toc2import.tmp
         endif       
      end
      if ( `cat $alephe_dev/$bibBaseL/scratch/obalky_toc_exp.tmp | wc -c | bc` < 20 ) then
         echo "Error - Oops. The record is too long to import any further data. Skipping" | tee -a $logfile
      else
         echo "The TOC has been trimmed at its end to `cat  $alephe_dev/$bibBaseL/scratch/toc2import.tmp | wc -c | bc` bytes" | tee -a $logfile 
         echo "     The TOC has been trimmed at its end to `cat  $alephe_dev/$bibBaseL/scratch/toc2import.tmp | wc -c | bc` bytes" >>$alephe_dev/$bibBaseL/scratch/toc2import.warn
      endif
   endif
#RC 20210315 end
   
   rm -f $alephe_dev/$bibBaseL/obalkyknih_toc2load.awk.tmp
   cat $alephe_dev/$bibBaseL/scratch/toc2import.tmp >>$alephe_dev/$bibBaseL/scratch/toc2import
   #kontrola na vice isbn v souboru - prida alert do logu, doplneno 20150609
   if ( `grep "^$sysno 020" $alephe_dev/$bibBaseL/scratch/obalky_toc_exp.tmp -c | bc` >1 ) then
      #20210204 pridany hodnoty podpole q do warning hlaseni pro lepsi zpracovani
      set noglob #ver 1.4.1. 20240801
      set isbnDesc=`grep "^$sysno 020" $alephe_dev/$bibBaseL/scratch/obalky_toc_exp.tmp | grep -o '\$\$q.*$' | tr -d '\n' `
      echo "WARNING - record with sysno $sysno has more than one ISBN - it's worthy of a check : $isbnDesc" | tee -a $logfile
      echo "WARNING - record with sysno $sysno has more than one ISBN - it's worthy of a check : $isbnDesc" >>$alephe_dev/$bibBaseL/scratch/toc2import.warn
   endif
   #kontrola na isbn v poli 902 - jde o vicesvazkovy zaznam, doplneno 20150612
   if ( `grep "^$sysno 902" $alephe_dev/$bibBaseL/scratch/obalky_toc_exp.tmp -c | bc` >0 ) then
      echo "WARNING - record with sysno $sysno has ISBN in field 902, looks like multi-vol record - it's worthy of a check" | tee -a $logfile
      echo "WARNING - record with sysno $sysno has ISBN in field 902, looks like multi-vol record - it's worthy of a check" >>$alephe_dev/$bibBaseL/scratch/toc2import.warn
   endif
   #kontrola, zda je v odpovedi api souborny zaznam, upozorni se do logu a mailu
   if ( `echo "$file" | grep 'ROOT' -ic | bc` >0 ) then
       echo "WARNING - record $sysno - the added toc is from 'souborny zaznam' (part_root)" | tee -a $logfile
       echo "WARNING - record $sysno - the added toc is from 'souborny zaznam' (part_root)" >>$alephe_dev/$bibBaseL/scratch/toc2import.warn
   endif
   printf "\n" >>$alephe_dev/$bibBaseL/scratch/toc2import
   rm -f $alephe_dev/$bibBaseL/scratch/toc2import.tmp
   mv $file "$dirwithTOCs/save-$datum/"
end
if (-z $alephe_dev/$bibBaseL/scratch/toc2import) then
   echo "Nothing to import :-[" | tee -a $logfile
else
   echo "Importing new TOCs using manage-18" | tee -a $logfile
   csh -f $aleph_proc/p_manage_18 "$bibBase,toc2import,toc2import.reject,toc2import.doc_log,OLD,,,FULL,APP,M,,,TOC_IMPORT," | grep -v '^Load' | tee -a $alephe_scratch/tocs_man18.log
   echo >>$alephe_dev/$bibBaseL/scratch/toc2import
   cat $alephe_dev/$bibBaseL/scratch/toc2import.warn >>$alephe_dev/$bibBaseL/scratch/toc2import
   rm -f $alephe_dev/$bibBaseL/scratch/toc2import.warn
   #kontrola na chyby 
   grep -e 'Upozorn' -e 'Error' -e 'Chyba' -i $alephe_scratch/tocs_man18.log >>$alephe_dev/$bibBaseL/scratch/toc2import
   rm -f $alephe_scratch/tocs_man18.log
   if ( "$mailAddr1" != "" ) then
      mail -s 'New TOCs from obalkyknih.cz' $mailAddr1 <$alephe_dev/$bibBaseL/scratch/toc2import
   endif
   if ( "$mailAddr2" != "" ) then
      mail -s 'New TOCs from obalkyknih.cz' $mailAddr2 <$alephe_dev/$bibBaseL/scratch/toc2import
   endif
   if ( -z $alephe_dev/$bibBaseL/scratch/toc2import.reject ) then
      echo "Import seems to be OK, no records were rejected." | tee -a $logfile
   else
      echo "ERROR. The sequent records has been rejected on import:" | tee -a $logfile
      cat $alephe_dev/$bibBaseL/scratch/toc2import.reject | tee -a $logfile
      if ( "$mailAddr1" != "" ) then
         mail  -s 'New TOCs from obalkyknih.cz - REJECTED RECORDS' $mailAddr1 <$alephe_dev/$bibBaseL/scratch/toc2import.reject
      endif
      if ( "$mailAddr2" != "" ) then
         mail  -s 'New TOCs from obalkyknih.cz - REJECTED RECORDS' $mailAddr2 <$alephe_dev/$bibBaseL/scratch/toc2import.reject
      endif
   endif
endif
echo "end - `date`" | tee -a $logfile


