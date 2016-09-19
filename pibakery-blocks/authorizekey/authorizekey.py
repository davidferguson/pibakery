#!/usr/bin/python

import sys
import os.path
import stat

public_key = sys.argv[1]

try:
    # Start at the user's $HOME directory.
    os.chdir(os.environ['HOME'])

    # Create a new .ssh directory, if necessary.
    if not os.path.exists('.ssh'):
        os.mkdir('.ssh')

    # Ensure that .ssh/ is rwx for owner but nobody else.
    os.chmod('.ssh', stat.S_IRWXU)

    # Enter .ssh/
    os.chdir('.ssh')

    # Append the public key to authorized_keys, creating the
    # file if necessary.
    with open('authorized_keys', 'a') as f:
        f.write(sys.argv[1] + '\n')
        f.close()

    # Ensure that authorized_keys is rw for owner but nobody else.
    os.chmod('authorized_keys', stat.S_IRUSR | stat.S_IWUSR)

except Exception as e:
    print e
    sys.exit(1)
