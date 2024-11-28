# Important notes!

Inside browser.js, we hardcoded-ly detect the path name for `zen-welcome` so we can add special attributes to the welcome page. If this path name changes, the welcome page will not work properly.

Make sure to update the path name in browser.js if you change the path name of `zen-welcome`.

The constant that contains this path name is `ZEN_WELCOME_PATH`.
