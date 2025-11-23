# Electric USB

Electric USB is a very simple Electron app that can load a website and grant it access to USB devices via WebUSB.

It can be useful to access WebUSB devices like [Keychron](https://launcher.keychron.com) or [Logitech](https://logiwebconnect.com).

I use it to adjust my Keychron keyboard and mouse without having to install a second Chrome-based browser.

# How to run it

```shell
npm run start
```

or

```shell
./node_modules/.bin/electron .
```

To specify a custom data dir, use the [--user-data-dir](https://chromium.googlesource.com/chromium/src/+/HEAD/docs/user_data_dir.md#overriding-the-user-data-directory) argument.

# Packaging

Use [Manual packaging](https://www.electronjs.org/docs/latest/tutorial/application-distribution#manual-packaging) to keep things simple.
