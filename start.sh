#!/bin/sh
ps aux |grep -v grep|grep node
sudo kill $(ps aux |grep -v grep|grep node|awk -F' ' '{print $2}')
nohup sudo env "PATH=$PATH" node server.js > out.log 2>&1 &
ps aux |grep -v grep|grep node
