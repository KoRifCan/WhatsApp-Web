#!/bin/bash
ssh -o StrictHostKeyChecking=no -o ServerAliveInterval=30 -R 80:localhost:3001 serveo.net
