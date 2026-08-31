# MECHA cloud bundle

`mecha.tar.gz.b64` and `mecha.manifest.json` are generated from the canonical `wringer-cloud` profile in the sibling MECHA source repository.

From the workspace MECHA repository, generate and verify with:

```text
python profiles/wringer-cloud/build_bundle.py
python profiles/wringer-cloud/build_bundle.py --check
```

The manifest pins the profile version, archive digest, every bundled file digest, the accepted context envelope, and the provider budget policy. The Wringer verifies the profile ID and archive SHA-256 before serving the MECHA start route.

Do not hand-edit either generated artifact.
