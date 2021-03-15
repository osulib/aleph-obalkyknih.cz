#!/bin/sh

echo ""
#$WWW_redd=`sed 's/text\/plain/application\/xml/'`
echo $WWW_redd >>redir.log
if [[ `echo $WWW_redd | grep 'obalkyknih.cz/?add_review=true' | bc` != '0' ]]; then
   read rating_value
   read review_text
   curl -s $WWW_redd --data "rating_value=$rating_value" --data "review_text=$review_text"
else
   curl -s $WWW_redd
fi


