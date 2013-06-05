#!/bin/bash

FILE=/tmp/mipmap.json

YEAR=$(date -d "yesterday" +"%Y")
MONTH=$(date -d "yesterday" +"%m")
DAY=$(date -d "yesterday" +"%d")

mget -q /mcavage/public/assets/mipmap-v0.1.0/job.json > $FILE

path=$(mfind -t o /$MANTA_USER/reports/access-logs/$YEAR/$MONTH/$DAY | \
    mjob create -qof $FILE)

rm -f $FILE

echo https://us-east.manta.joyent.com$path