#!/bin/bash

for d in $(find $1 -type d | cut -d / -f 4-)
do
    if [ -n  "$d" ]
    then
        mmkdir -p /$MANTA_USER/public/mipmap/$MANTA_JOB_ID/$d
    fi
done

for f in $(find $1 -type f | cut -d / -f 4-)
do
    if [ -n  "$f" ]
    then
        mput -f $1/$f /$MANTA_USER/public/mipmap/$MANTA_JOB_ID/$f
    fi
done

echo /$MANTA_USER/public/mipmap/$MANTA_JOB_ID/index.html
