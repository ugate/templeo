## [0.1.0](https://github.com/ugate/templeo/tree/v0.1.0) (2019-02-06)
[Full Changelog](https://github.com/ugate/templeo/compare/v0.1.0...v0.1.0)


__Features:__
* [[FEATURE]: Cached includes will only read a partial with the same name and URLSearchParams once. Any partial with the same name, but different URLSearchParams will be read multiple times.](https://github.com/ugate/templeo/commit/4e6402051e665ca8718a30ac116c91115e56fb8d)
* [[FEATURE]: Helper directives/functions can be registered via Engine.registerHelper and will be compiled along with the built-in directives](https://github.com/ugate/templeo/commit/690bfeeae899d0fe4ce2c063ed9b13f70ca3effd)
* [[FEATURE]: Debugger option sets a standard debugger statement into each rendered template. Metadata accessibility from within templates.](https://github.com/ugate/templeo/commit/3c8c14cdfe96de29b1f042f309a7f2908b8afb30)
* [[FEATURE]: Include parameters can be set to either URLSearchParams to initiate a read or JSON to add the parameters to the partial scope](https://github.com/ugate/templeo/commit/643fe36e2798a879ab02956566e6f1d640a03a5c)
* [[FEATURE]: Passing parameters to the include directive for use on the server and/or within the partial template itself using the options.includesParametersName](https://github.com/ugate/templeo/commit/affac39a7e8de3f8f0ea8baa63c9d64c61b04225)
* [[FEATURE]: options.defaultBaseTemplateName added to allow naming of the template being compiled](https://github.com/ugate/templeo/commit/127f8b2028c23988f9065bae27ed821061bc4f8a)
* [[FEATURE]: Assignments can be made that are outside the primary context passed into the rendering function (i.e. "it"). Templates can designate something like {{ myVarName = 'Some value' }} which can later be retrieved via {{ myVarName }}. This is a static namespace for use during compilation rather than during rendering (e.g. renderFunction({ myVarName: 'Some value' }) with the template using {{ it.myVarName }}).](https://github.com/ugate/templeo/commit/c88303bdcfdd651e329508b0f4745c301962f6a8)